import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession } from "@/server/auth/session";
import { routeHandler } from "@/server/http/routeHandler";

/** Deletes the session row as well as the cookie, so the token cannot be replayed. */
export async function POST() {
  return routeHandler("admin logout", async () => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    await destroySession(token);
    store.delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  });
}
