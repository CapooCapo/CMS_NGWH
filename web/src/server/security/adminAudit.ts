import "server-only";
import { createAdminAuditLog, type AdminAuditInput } from "@/server/repositories/adminAuditLogs";
import { transaction } from "@/server/db/pool";
import { clientIp } from "./loginRateLimit";

/**
 * Route-level audit helper. Metadata must be an allowlisted summary (changed
 * fields and IDs), never a request body, password, token, or document value.
 */
export async function auditAdminMutation(
  request: Request,
  input: Omit<AdminAuditInput, "ip">
): Promise<void> {
  await createAdminAuditLog({ ...input, ip: clientIp(request) });
}

/**
 * Runs a business mutation and its audit insert in one PostgreSQL transaction.
 * Repository helpers use the transaction context established by `transaction`,
 * so existing parameterised queries share the same client without route-level
 * plumbing.
 */
export async function auditedAdminMutation<T>(
  request: Request,
  input:
    | Omit<AdminAuditInput, "ip">
    | ((result: T) => Omit<AdminAuditInput, "ip">),
  mutate: () => Promise<T>,
  shouldAudit: (result: T) => boolean = () => true
): Promise<T> {
  return transaction(async () => {
    const result = await mutate();
    if (shouldAudit(result)) {
      await auditAdminMutation(request, typeof input === "function" ? input(result) : input);
    }
    return result;
  });
}
