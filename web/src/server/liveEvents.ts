import "server-only";
import { Client } from "pg";
import { databaseConnectionOptions } from "@/server/db/options";
import { findMatchById } from "@/server/repositories/matches";
import type { MatchWithContext } from "@/server/repositories/types";
import { LIVE_MATCH_CHANNEL } from "@/server/services/liveMatchUpdates";

export type LiveMatchEvent = {
  type: "match.updated";
  eventId: string;
  matchId: number;
  revision: number;
  match: MatchWithContext;
};

type Subscriber = (event: LiveMatchEvent | null) => void;
type Registry = {
  subscribers: Set<Subscriber>;
  client: Client | null;
  connecting: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

const globalForLiveEvents = globalThis as typeof globalThis & { ngwhLiveEvents?: Registry };
const registry: Registry = globalForLiveEvents.ngwhLiveEvents ?? {
  subscribers: new Set(),
  client: null,
  connecting: null,
  reconnectTimer: null,
};
globalForLiveEvents.ngwhLiveEvents = registry;

function scheduleReconnect() {
  if (registry.reconnectTimer || registry.subscribers.size === 0) return;
  registry.reconnectTimer = setTimeout(() => {
    registry.reconnectTimer = null;
    void ensureListener();
  }, 3_000);
}

function closeSubscribersForResync() {
  // PostgreSQL listener loss can otherwise leave a healthy browser SSE socket
  // without a source of events. Closing it makes EventSource reconnect and run
  // the ordinary JSON resync path.
  for (const subscriber of registry.subscribers) subscriber(null);
}

async function broadcast(matchId: number, notifiedRevision: number) {
  const match = await findMatchById(matchId);
  // A later committed update may have won the race to the projection. Sending
  // that newer row is safe; sending an older row never is.
  if (!match || match.live_revision < notifiedRevision) return;
  const event: LiveMatchEvent = {
    type: "match.updated",
    eventId: `match:${match.id}:${match.live_revision}`,
    matchId: match.id,
    revision: match.live_revision,
    match,
  };
  for (const subscriber of registry.subscribers) subscriber(event);
}

async function ensureListener(): Promise<void> {
  if (registry.client || registry.connecting || registry.subscribers.size === 0) {
    return registry.connecting ?? Promise.resolve();
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  registry.connecting = (async () => {
    const client = new Client(databaseConnectionOptions(connectionString));
    client.on("notification", (notification) => {
      if (notification.channel !== LIVE_MATCH_CHANNEL || !notification.payload) return;
      try {
        const payload = JSON.parse(notification.payload) as {
          matchId?: unknown;
          revision?: unknown;
        };
        if (
          typeof payload.matchId !== "number" ||
          !Number.isSafeInteger(payload.matchId) ||
          typeof payload.revision !== "number" ||
          !Number.isSafeInteger(payload.revision)
        ) return;
        void broadcast(payload.matchId, payload.revision);
      } catch {
        // Ignore malformed notifications: only this application can publish to
        // the private channel, and a bad payload must not end every SSE stream.
      }
    });
    client.on("error", () => {
      if (registry.client === client) {
        registry.client = null;
        closeSubscribersForResync();
      }
      scheduleReconnect();
    });
    client.on("end", () => {
      if (registry.client === client) {
        registry.client = null;
        closeSubscribersForResync();
      }
      scheduleReconnect();
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${LIVE_MATCH_CHANNEL}`);
      registry.client = client;
    } catch {
      await client.end().catch(() => undefined);
      scheduleReconnect();
    } finally {
      registry.connecting = null;
    }
  })();
  return registry.connecting;
}

/** Register a local SSE client; PostgreSQL fans committed updates across processes. */
export async function subscribeLiveMatches(subscriber: Subscriber): Promise<() => void> {
  registry.subscribers.add(subscriber);
  await ensureListener();
  return () => {
    registry.subscribers.delete(subscriber);
  };
}
