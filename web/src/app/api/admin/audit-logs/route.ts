import { requireRole } from "@/server/auth/guard";
import { errorResponse } from "@/server/http/errors";
import { routeHandler } from "@/server/http/routeHandler";
import {
  ADMIN_AUDIT_API_MAX_LIMIT,
  listAdminAuditLogs,
  type AdminAuditFilters,
} from "@/server/repositories/adminAuditLogs";

const ACTION_RE = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
const RESOURCE_TYPE_RE = /^[a-z][a-z0-9_]*$/;

function one(searchParams: URLSearchParams, name: string): string | null {
  const values = searchParams.getAll(name);
  return values.length === 1 ? values[0] : values.length === 0 ? null : "";
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function filters(searchParams: URLSearchParams): AdminAuditFilters | null {
  const actor = one(searchParams, "actor");
  const action = one(searchParams, "action");
  const resourceType = one(searchParams, "resourceType");
  if (actor === "" || action === "" || resourceType === "") return null;
  const actorId = positiveInteger(actor, 0, Number.MAX_SAFE_INTEGER);
  if (actorId === null || (actor !== null && actorId === 0)) return null;
  if (action !== null && !ACTION_RE.test(action)) return null;
  if (resourceType !== null && !RESOURCE_TYPE_RE.test(resourceType)) return null;
  return {
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(resourceType ? { resourceType } : {}),
  };
}

/** Privileged, read-only history. There are intentionally no write handlers. */
export async function GET(request: Request) {
  return routeHandler("list admin audit logs", async () => {
    const guard = await requireRole();
    if (!guard.ok) {
      return errorResponse(guard.response.status, guard.response.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN");
    }

    const searchParams = new URL(request.url).searchParams;
    const page = positiveInteger(one(searchParams, "page"), 1, Number.MAX_SAFE_INTEGER);
    const limit = positiveInteger(one(searchParams, "limit"), ADMIN_AUDIT_API_MAX_LIMIT, ADMIN_AUDIT_API_MAX_LIMIT);
    const auditFilters = filters(searchParams);
    if (page === null || limit === null || !auditFilters) return errorResponse(400, "INVALID_INPUT");

    const logs = await listAdminAuditLogs(page, auditFilters, limit);
    return Response.json({
      items: logs.rows,
      pagination: { page: logs.page, limit: logs.pageSize, total: logs.total, totalPages: logs.totalPages },
    });
  });
}
