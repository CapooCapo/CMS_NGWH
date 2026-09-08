import "server-only";
import type { PoolClient } from "pg";
import { query } from "@/server/db/pool";
import {
  ADMIN_PAGE_SIZE,
  resolvePagination,
  type PaginatedResult,
} from "@/lib/pagination";

export type AdminAuditInput = {
  actorId: number;
  action: string;
  resourceType: string;
  resourceId: string | number;
  metadata?: Record<string, string | number | boolean | null | readonly string[]>;
  ip: string | null;
};

export type AdminAuditLog = {
  /** PostgreSQL BIGINT is serialized as text to avoid JavaScript precision loss. */
  id: string;
  actorId: number;
  actorUsername: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, string | number | boolean | null | string[]>;
  clientIp: string | null;
  /** Absolute ISO-8601 UTC instant, safe for API consumers and `Date`. */
  createdAt: string;
};

export type AdminAuditFilters = {
  actorId?: number;
  action?: string;
  resourceType?: string;
};

const AUDIT_COLUMNS = `l.id::text AS id, l.actor_id AS "actorId", u.username AS "actorUsername",
  l.action, l.resource_type AS "resourceType", l.resource_id AS "resourceId",
  l.metadata, host(l.ip) AS "clientIp",
  to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`;

/** Bounded default for the API while pages retain the shared admin page size. */
export const ADMIN_AUDIT_API_MAX_LIMIT = 50;

function where(filters: AdminAuditFilters): { clause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.actorId) {
    params.push(filters.actorId);
    conditions.push(`l.actor_id = $${params.length}`);
  }
  if (filters.action) {
    params.push(filters.action);
    conditions.push(`l.action = $${params.length}`);
  }
  if (filters.resourceType) {
    params.push(filters.resourceType);
    conditions.push(`l.resource_type = $${params.length}`);
  }
  return { clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

/**
 * The write API only admits primitive, allowlisted summaries. This defensive
 * read normalization keeps future malformed or legacy rows from exposing a
 * nested request body, credential, or oversized value through the history UI.
 */
function safeMetadata(value: unknown): AdminAuditLog["metadata"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const safe: AdminAuditLog["metadata"] = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 12)) {
    if (/(?:pass|token|secret|cookie|authorization|content|body)/i.test(key)) continue;
    if (typeof item === "string") safe[key] = item.slice(0, 500);
    else if (typeof item === "number" || typeof item === "boolean" || item === null) safe[key] = item;
    else if (Array.isArray(item) && item.every((child) => typeof child === "string")) {
      safe[key] = item.slice(0, 20).map((child) => child.slice(0, 160));
    }
  }
  return safe;
}

function normalize(row: Omit<AdminAuditLog, "metadata"> & { metadata: unknown }): AdminAuditLog {
  return { ...row, metadata: safeMetadata(row.metadata) };
}

/** Insert-only repository. The database trigger enforces append-only storage. */
export async function createAdminAuditLog(
  input: AdminAuditInput,
  client?: PoolClient
): Promise<void> {
  const text = `INSERT INTO admin_audit_logs
    (actor_id, action, resource_type, resource_id, metadata, ip)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet)`;
  const params = [
    input.actorId,
    input.action,
    input.resourceType,
    String(input.resourceId),
    JSON.stringify(input.metadata ?? {}),
    input.ip,
  ];
  if (client) {
    await client.query(text, params);
  } else {
    await query(text, params);
  }
}

/** Read-only, newest-first audit history for privileged administrators. */
export async function listAdminAuditLogs(
  requestedPage: number,
  filters: AdminAuditFilters = {},
  pageSize = ADMIN_PAGE_SIZE
): Promise<PaginatedResult<AdminAuditLog>> {
  const boundedPageSize = Math.min(Math.max(1, Math.floor(pageSize)), ADMIN_AUDIT_API_MAX_LIMIT);
  const { clause, params } = where(filters);
  const [count] = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM admin_audit_logs l
       JOIN admin_users u ON u.id = l.actor_id
       ${clause}`,
    params
  );
  const pagination = resolvePagination(requestedPage, Number(count?.count ?? 0), boundedPageSize);
  const rows = await query<Omit<AdminAuditLog, "metadata"> & { metadata: unknown }>(
    `SELECT ${AUDIT_COLUMNS}
       FROM admin_audit_logs l
       JOIN admin_users u ON u.id = l.actor_id
       ${clause}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pagination.pageSize, pagination.offset]
  );
  return { ...pagination, rows: rows.map(normalize) };
}
