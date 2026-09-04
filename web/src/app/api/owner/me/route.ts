import { NextResponse } from "next/server";
import { requireOwner } from "@/server/auth/ownerGuard";

/** Current Club Owner identity; 401 when not signed in. */
export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ owner: guard.owner });
}
