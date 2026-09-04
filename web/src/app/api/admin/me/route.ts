import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/guard";

/** Current staff identity; 401 when not signed in. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ user: guard.admin });
}
