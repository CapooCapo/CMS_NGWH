import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OWNER_SESSION_COOKIE, destroyOwnerSession } from "@/server/auth/ownerSession";
import { routeHandler } from "@/server/http/routeHandler";

/** Deletes the session row as well as the cookie, so the token cannot be replayed. */
export async function POST() {
  return routeHandler("owner logout", async () => {
    const store = await cookies();
    const token = store.get(OWNER_SESSION_COOKIE)?.value;
    await destroyOwnerSession(token);
    store.delete(OWNER_SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  });
}
