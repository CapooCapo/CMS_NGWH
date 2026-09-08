import { NextResponse } from "next/server";
import { currentOwner } from "@/server/auth/ownerSession";
import { errorResponse } from "@/server/http/errors";
import { routeHandler } from "@/server/http/routeHandler";

/** Current Club Owner identity; 401 when not signed in. */
export async function GET() {
  return routeHandler("owner me", async () => {
    const owner = await currentOwner();
    if (!owner) return errorResponse(401, "UNAUTHENTICATED");
    return NextResponse.json({ owner });
  });
}
