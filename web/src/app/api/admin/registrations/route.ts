import { requireViewer } from "@/server/auth/guard";
import { listRegistrations } from "@/server/repositories/registrations";
import { fail, ok } from "@/server/api/respond";
import type { RegistrationStatus } from "@/server/repositories/types";

const STATUSES: readonly RegistrationStatus[] = ["pending", "approved", "rejected"];

/** REQ-REG-001 review queue. Staff only. */
export async function GET(request: Request) {
  const guard = await requireViewer("editor");
  if (!guard.ok) return guard.response;
  try {
    const raw = new URL(request.url).searchParams.get("status");
    const status = STATUSES.includes(raw as RegistrationStatus)
      ? (raw as RegistrationStatus)
      : null;
    return ok({ registrations: await listRegistrations(status) });
  } catch (error) {
    return fail("list registrations", error);
  }
}
