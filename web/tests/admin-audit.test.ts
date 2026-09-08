import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { query, queryOne, transaction } from "../src/server/db/pool";
import {
  createAdminAuditLog,
  listAdminAuditLogs,
} from "../src/server/repositories/adminAuditLogs";
import { auditedAdminMutation } from "../src/server/security/adminAudit";
import {
  adjustLiveMatch,
  scoreAuditMetadata,
  updateLiveMatch,
  updateLiveScore,
} from "../src/server/services/liveMatchUpdates";
import type { MatchWithContext } from "../src/server/repositories/types";

const TAG = `test-audit-${process.pid}`;
let actorId: number | null = null;
let scoreSeasonId: number | null = null;
let scoreMatchId: number | null = null;
const originalTrustProxy = process.env.TRUST_PROXY_X_FORWARDED_FOR;

before(async () => {
  process.env.TRUST_PROXY_X_FORWARDED_FOR = "true";
  const actor = await queryOne<{ id: number }>("SELECT id FROM admin_users ORDER BY id LIMIT 1");
  actorId = actor?.id ?? null;
  if (!actorId) return;
  const [season] = await query<{ id: number }>(
    `INSERT INTO seasons (slug, name_en, name_vi, status)
     VALUES ($1, 'Score audit test', 'Score audit test', 'active') RETURNING id`,
    [`${TAG}-scores`]
  );
  scoreSeasonId = season.id;
  const [match] = await query<{ id: number }>(
    `INSERT INTO matches (season_id, home_team_name, away_team_name, scheduled_at,
       status, home_score, away_score)
     VALUES ($1, 'Home', 'Away', now(), 'live', 1, 0) RETURNING id`,
    [scoreSeasonId]
  );
  scoreMatchId = match.id;
});

after(async () => {
  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY_X_FORWARDED_FOR;
  else process.env.TRUST_PROXY_X_FORWARDED_FOR = originalTrustProxy;
  if (scoreSeasonId) await query("DELETE FROM seasons WHERE id = $1", [scoreSeasonId]);
  const { pool } = await import("../src/server/db/pool");
  await pool.end();
});

function request(ip?: string) {
  return new Request("http://test/api/admin/example", {
    headers: ip ? { "x-forwarded-for": ip } : undefined,
  });
}

async function withRollback(fn: (client: PoolClient) => Promise<void>) {
  const rollback = new Error("intentional test rollback");
  await assert.rejects(
    transaction(async (client) => {
      await fn(client);
      throw rollback;
    }),
    rollback
  );
}

test("audit migration creates the table and both query indexes", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  const [row] = await query<{
    table_name: string | null;
    actor_index: string | null;
    resource_index: string | null;
  }>(`SELECT to_regclass('public.admin_audit_logs') AS table_name,
             to_regclass('public.admin_audit_logs_actor_created_at_idx') AS actor_index,
             to_regclass('public.admin_audit_logs_resource_created_at_idx') AS resource_index`);
  assert.deepEqual(row, {
    table_name: "admin_audit_logs",
    actor_index: "admin_audit_logs_actor_created_at_idx",
    resource_index: "admin_audit_logs_resource_created_at_idx",
  });
});

test("a business mutation and its audit insert use one transaction", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const season = await auditedAdminMutation(
      request("198.51.100.50"),
      (created) => ({
        actorId: actorId!, action: "test.season.create", resourceType: "season", resourceId: created.id,
        metadata: { source: "test" },
      }),
      async () => {
        const [created] = await query<{ id: number }>(
          `INSERT INTO seasons (slug, name_en, name_vi, status)
           VALUES ($1, 'Audit test', 'Audit test', 'upcoming') RETURNING id`,
          [`${TAG}-success`]
        );
        return created;
      }
    );
    const [audit] = await query<{
      actor_id: number;
      action: string;
      resource_type: string;
      resource_id: string;
      ip: string | null;
      metadata: { source: string };
      created_at: string;
    }>(`SELECT actor_id, action, resource_type, resource_id, ip::text AS ip, metadata, created_at::text
        FROM admin_audit_logs WHERE resource_id = $1`, [String(season.id)]);
    assert.deepEqual(audit, {
      actor_id: actorId,
      action: "test.season.create",
      resource_type: "season",
      resource_id: String(season.id),
      ip: "198.51.100.50/32",
      metadata: { source: "test" },
      created_at: audit.created_at,
    });
    assert.ok(audit.created_at);
    assert.ok(!Number.isNaN(new Date(audit.created_at).getTime()));
  });
});

test("an audit failure rolls back its business mutation and failed mutations leave no audit", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  const rollbackSlug = `${TAG}-audit-failure`;
  await assert.rejects(
    auditedAdminMutation(
      request(),
      { actorId: -1, action: "test.failure", resourceType: "season", resourceId: rollbackSlug },
      async () => {
        await query(
          `INSERT INTO seasons (slug, name_en, name_vi, status)
           VALUES ($1, 'Audit test', 'Audit test', 'upcoming')`,
          [rollbackSlug]
        );
        return true;
      }
    )
  );
  assert.equal((await query("SELECT id FROM seasons WHERE slug = $1", [rollbackSlug])).length, 0);

  const auditsBefore = await query("SELECT id FROM admin_audit_logs WHERE action = 'test.mutation.failure'");
  await assert.rejects(
    auditedAdminMutation(
      request(),
      { actorId, action: "test.mutation.failure", resourceType: "season", resourceId: "none" },
      async () => {
        throw new Error("forced business failure");
      }
    )
  );
  const auditsAfter = await query("SELECT id FROM admin_audit_logs WHERE action = 'test.mutation.failure'");
  assert.equal(auditsAfter.length, auditsBefore.length);
});

test("audit IPs accept IPv4 and IPv6, and store null for missing or invalid values", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    for (const [resourceId, ip] of [
      ["ipv4", "198.51.100.51"],
      ["ipv6", "2001:db8::51"],
      ["missing", undefined],
      ["invalid", "not-an-ip"],
    ] as const) {
      await auditedAdminMutation(
        request(ip),
        { actorId: actorId!, action: "test.ip", resourceType: "test", resourceId },
        async () => true
      );
    }
    const rows = await query<{ resource_id: string; ip: string | null }>(
      `SELECT resource_id, ip::text AS ip FROM admin_audit_logs
       WHERE action = 'test.ip' ORDER BY resource_id`
    );
    assert.deepEqual(rows, [
      { resource_id: "invalid", ip: null },
      { resource_id: "ipv4", ip: "198.51.100.51/32" },
      { resource_id: "ipv6", ip: "2001:db8::51/128" },
      { resource_id: "missing", ip: null },
    ]);
  });
});

test("audit rows reject UPDATE and DELETE while INSERT uses the repository path", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  await withRollback(async (client) => {
    await createAdminAuditLog({
      actorId: actorId!,
      action: "test.append-only",
      resourceType: "test",
      resourceId: TAG,
      ip: null,
    }, client);
    const [{ id }] = await client.query<{ id: number }>(
      "SELECT id FROM admin_audit_logs WHERE action = 'test.append-only' AND resource_id = $1",
      [TAG]
    ).then((result) => result.rows);

    await client.query("SAVEPOINT audit_update");
    await assert.rejects(client.query("UPDATE admin_audit_logs SET action = 'changed' WHERE id = $1", [id]));
    await client.query("ROLLBACK TO SAVEPOINT audit_update");
    await client.query("SAVEPOINT audit_delete");
    await assert.rejects(client.query("DELETE FROM admin_audit_logs WHERE id = $1", [id]));
    await client.query("ROLLBACK TO SAVEPOINT audit_delete");
  });
});

test("audit history is newest-first, paginated, filtered, and omits sensitive metadata", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  await withRollback(async (client) => {
    for (const resourceId of ["first", "second", "third"]) {
      await createAdminAuditLog({
        actorId: actorId!,
        action: "test.audit.read",
        resourceType: "test",
        resourceId,
        metadata: {
          changed: [resourceId],
          password: "never expose this",
        },
        ip: null,
      }, client);
    }
    const firstPage = await listAdminAuditLogs(1, { action: "test.audit.read" }, 2);
    assert.equal(firstPage.total, 3);
    assert.equal(firstPage.pageSize, 2);
    assert.deepEqual(firstPage.rows.map((row) => row.resourceId), ["third", "second"]);
    assert.deepEqual(firstPage.rows[0]?.metadata, { changed: ["third"] });
    assert.match(firstPage.rows[0]?.createdAt ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(!Number.isNaN(new Date(firstPage.rows[0]?.createdAt).getTime()));

    const secondPage = await listAdminAuditLogs(2, { action: "test.audit.read" }, 2);
    assert.deepEqual(secondPage.rows.map((row) => row.resourceId), ["first"]);
    const filtered = await listAdminAuditLogs(1, { actorId: actorId!, resourceType: "test" }, 50);
    assert.ok(filtered.rows.every((row) => row.actorId === actorId && row.resourceType === "test"));
  });
});

test("score audit entries receive a default ISO creation time", async (t) => {
  if (!actorId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const resourceId = `${TAG}-score`;
    await auditedAdminMutation(
      request(),
      {
        actorId: actorId!,
        action: "match.score.update",
        resourceType: "match",
        resourceId,
        metadata: { changed: ["homeScore", "awayScore"] },
      },
      async () => true
    );
    const logs = await listAdminAuditLogs(1, { action: "match.score.update" }, 50);
    const scoreAudit = logs.rows.find((row) => row.resourceId === resourceId);
    assert.ok(scoreAudit);
    assert.match(scoreAudit.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(!Number.isNaN(new Date(scoreAudit.createdAt).getTime()));
  });
});

function scoreAuditInput(
  before: Parameters<typeof scoreAuditMetadata>[0],
  after: Parameters<typeof scoreAuditMetadata>[1],
  includeUnchangedScore = false
) {
  return {
    actorId: actorId!,
    action: "match.score.update",
    resourceType: "match",
    resourceId: scoreMatchId!,
    metadata: scoreAuditMetadata(before, after, { includeUnchangedScore }) ?? {},
  };
}

async function auditRows() {
  return query<{
    metadata: {
      changedFields?: string[];
      before?: Record<string, number | string>;
      after?: Record<string, number | string>;
    };
  }>(
    `SELECT metadata FROM admin_audit_logs
     WHERE action = 'match.score.update' AND resource_id = $1 ORDER BY id ASC`,
    [String(scoreMatchId)]
  );
}

type ScoreAdjustment = Awaited<ReturnType<typeof adjustLiveMatch>>;
type SuccessfulScoreAdjustment = ScoreAdjustment & {
  match: MatchWithContext;
  before: Parameters<typeof scoreAuditMetadata>[0];
  after: Parameters<typeof scoreAuditMetadata>[1];
};

function hasCommittedMatch(update: ScoreAdjustment): update is SuccessfulScoreAdjustment {
  return update.match !== null;
}

function adjustmentAuditInput(update: ScoreAdjustment) {
  return hasCommittedMatch(update)
    ? scoreAuditInput(update.before, update.after)
    : {
        actorId: actorId!,
        action: "match.score.update",
        resourceType: "match",
        resourceId: scoreMatchId!,
        metadata: {},
      };
}

test("direct score save records the committed 1-0 to 2-0 transition", async (t) => {
  if (!actorId || !scoreMatchId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const update = await auditedAdminMutation(
      request("198.51.100.60"),
      (result) => scoreAuditInput(result!.before, result!.after, true),
      () => updateLiveScore(scoreMatchId!, 2, 0, "live", null),
      Boolean
    );
    assert.ok(update);
    assert.deepEqual(update.before, {
      homeScore: 1,
      awayScore: 0,
      homeFouls: 0,
      awayFouls: 0,
      status: "live",
    });
    assert.deepEqual(update.after, {
      homeScore: 2,
      awayScore: 0,
      homeFouls: 0,
      awayFouls: 0,
      status: "live",
    });
    const [audit] = await auditRows();
    assert.deepEqual(audit.metadata, {
      changedFields: ["homeScore"],
      before: { homeScore: 1, awayScore: 0 },
      after: { homeScore: 2, awayScore: 0 },
    });
    const logs = await listAdminAuditLogs(1, { action: "match.score.update" }, 50);
    const log = logs.rows.find((row) => row.resourceId === String(scoreMatchId));
    assert.deepEqual(log?.metadata, audit.metadata);
    assert.ok(log?.createdAt);
    assert.equal(log?.actorId, actorId);
    assert.equal(log?.clientIp, "198.51.100.60");
  });
});

test("away score adjustment records the changed side and complete score transition", async (t) => {
  if (!actorId || !scoreMatchId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const update = await auditedAdminMutation(
      request(),
      adjustmentAuditInput,
      () => adjustLiveMatch(scoreMatchId!, "away", "score", 2),
      (result) => Boolean(result.match)
    );
    if (!hasCommittedMatch(update)) assert.fail("score update was unexpectedly rejected");
    assert.deepEqual(update.before, {
      homeScore: 1,
      awayScore: 0,
      homeFouls: 0,
      awayFouls: 0,
      status: "live",
    });
    assert.deepEqual(update.after, {
      homeScore: 1,
      awayScore: 2,
      homeFouls: 0,
      awayFouls: 0,
      status: "live",
    });
    const [audit] = await auditRows();
    assert.deepEqual(audit.metadata, {
      changedFields: ["awayScore"],
      before: { homeScore: 1, awayScore: 0 },
      after: { homeScore: 1, awayScore: 2 },
    });
  });
});

test("full match result updates retain score and status transitions in the existing match.update audit", async (t) => {
  if (!actorId || !scoreMatchId || !scoreSeasonId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const update = await auditedAdminMutation(
      request(),
      (result) => ({
        actorId: actorId!,
        action: "match.update",
        resourceType: "match",
        resourceId: scoreMatchId!,
        metadata: {
          changed: ["homeScore", "awayScore", "status"],
          ...(result ? scoreAuditMetadata(result.before, result.after) ?? {} : {}),
        },
      }),
      () => updateLiveMatch(scoreMatchId!, {
        seasonId: scoreSeasonId!,
        homeClubId: null,
        awayClubId: null,
        homeTeamName: "Home",
        awayTeamName: "Away",
        venue: null,
        scheduledAt: new Date("2030-01-01T10:00:00Z"),
        status: "completed",
        homeScore: 2,
        awayScore: 1,
        period: null,
      }),
      Boolean
    );
    assert.ok(update);
    const [audit] = await query<{
      metadata: Record<string, unknown>;
    }>(
      `SELECT metadata FROM admin_audit_logs
       WHERE action = 'match.update' AND resource_id = $1 ORDER BY id DESC LIMIT 1`,
      [String(scoreMatchId)]
    );
    assert.deepEqual(audit.metadata, {
      changed: ["homeScore", "awayScore", "status"],
      changedFields: ["homeScore", "awayScore", "status"],
      before: { homeScore: 1, awayScore: 0, status: "live" },
      after: { homeScore: 2, awayScore: 1, status: "completed" },
    });
  });
});

test("a rejected score mutation writes no audit row", async (t) => {
  if (!actorId || !scoreMatchId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const update = await auditedAdminMutation(
      request(),
      adjustmentAuditInput,
      () => adjustLiveMatch(scoreMatchId!, "home", "foul", -1),
      (result) => Boolean(result.match)
    );
    assert.deepEqual(update, { match: null, scoreRejected: true });
    assert.equal((await auditRows()).length, 0);
  });
});

test("an audit-insert failure rolls back a score mutation", async (t) => {
  if (!scoreMatchId) return t.skip("no match fixture in configured database");
  await assert.rejects(
    auditedAdminMutation(
      request(),
      (result) => ({
        actorId: -1,
        action: "match.score.update",
        resourceType: "match",
        resourceId: scoreMatchId!,
        metadata: result ? scoreAuditMetadata(result.before, result.after, { includeUnchangedScore: true }) ?? {} : {},
      }),
      () => updateLiveScore(scoreMatchId!, 2, 0, "live", null),
      Boolean
    )
  );
  const [match] = await query<{ home_score: number; away_score: number; live_revision: number }>(
    "SELECT home_score, away_score, live_revision FROM matches WHERE id = $1",
    [scoreMatchId]
  );
  assert.deepEqual(match, { home_score: 1, away_score: 0, live_revision: 0 });
  assert.equal((await auditRows()).length, 0);
});

test("concurrent score adjustments audit each serialized database transition", async (t) => {
  if (!actorId || !scoreMatchId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const updates = await Promise.all(
      [1, 1].map(() => auditedAdminMutation(
        request(),
        adjustmentAuditInput,
        () => adjustLiveMatch(scoreMatchId!, "home", "score", 1),
        (result) => Boolean(result.match)
      ))
    );
    assert.ok(updates.every(hasCommittedMatch));
    assert.deepEqual(updates.map((update) => update.after.homeScore).sort(), [2, 3]);
    const rows = await auditRows();
    assert.deepEqual(rows.map((row) => row.metadata), [
      {
        changedFields: ["homeScore"],
        before: { homeScore: 1, awayScore: 0 },
        after: { homeScore: 2, awayScore: 0 },
      },
      {
        changedFields: ["homeScore"],
        before: { homeScore: 2, awayScore: 0 },
        after: { homeScore: 3, awayScore: 0 },
      },
    ]);
  });
});

test("foul adjustment records only the changed foul count", async (t) => {
  if (!actorId || !scoreMatchId) return t.skip("no admin fixture in configured database");
  await withRollback(async () => {
    const update = await auditedAdminMutation(
      request(),
      adjustmentAuditInput,
      () => adjustLiveMatch(scoreMatchId!, "home", "foul", 1),
      (result) => Boolean(result.match)
    );
    if (!hasCommittedMatch(update)) assert.fail("foul update was unexpectedly rejected");
    assert.deepEqual(update.before, {
      homeScore: 1,
      awayScore: 0,
      homeFouls: 0,
      awayFouls: 0,
      status: "live",
    });
    assert.deepEqual(update.after, {
      homeScore: 1,
      awayScore: 0,
      homeFouls: 1,
      awayFouls: 0,
      status: "live",
    });
    const [audit] = await auditRows();
    assert.deepEqual(audit.metadata, {
      changedFields: ["homeFouls"],
      before: { homeFouls: 0 },
      after: { homeFouls: 1 },
    });
  });
});
