import "server-only";
import type { PoolClient } from "pg";
import { query } from "@/server/db/pool";

export type AdminAuditInput = {
  actorId: number;
  action: string;
  resourceType: string;
  resourceId: string | number;
  metadata?: Record<string, string | number | boolean | null | readonly string[]>;
  ip: string | null;
};

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
