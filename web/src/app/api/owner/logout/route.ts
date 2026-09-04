import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OWNER_SESSION_COOKIE, destroyOwnerSession } from "@/server/auth/ownerSession";

/** Deletes the session row as well as the cookie, so the token cannot be replayed. */
export async function POST() {
  const store = await cookies();
  const token = store.get(OWNER_SESSION_COOKIE)?.value;
  await destroyOwnerSession(token);
  store.delete(OWNER_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
