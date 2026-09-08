import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth/session";
import { errorResponse } from "@/server/http/errors";
import { routeHandler } from "@/server/http/routeHandler";

/** Current staff identity; 401 when not signed in. */
export async function GET() {
  return routeHandler("admin me", async () => {
    const admin = await currentAdmin();
    if (!admin) return errorResponse(401, "UNAUTHENTICATED");
    return NextResponse.json({ user: admin });
  });
}
