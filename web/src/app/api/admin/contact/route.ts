import { requireViewer } from "@/server/auth/guard";
import { listContactMessages } from "@/server/repositories/contact";
import { fail, ok } from "@/server/api/respond";
import type { ContactStatus } from "@/server/repositories/types";

const STATUSES: readonly ContactStatus[] = ["new", "read", "archived"];

/** REQ-CONTACT-002 — the admin inbox. OQ-014 leaves routing undecided, so this is where submissions land. */
export async function GET(request: Request) {
  const guard = await requireViewer("editor");
  if (!guard.ok) return guard.response;
  try {
    const raw = new URL(request.url).searchParams.get("status");
    const status = STATUSES.includes(raw as ContactStatus)
      ? (raw as ContactStatus)
      : null;
    return ok({ messages: await listContactMessages(status) });
  } catch (error) {
    return fail("list contact messages", error);
  }
}
