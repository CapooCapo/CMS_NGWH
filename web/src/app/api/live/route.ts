import { NextResponse } from "next/server";
import { getLiveAndResults } from "@/server/repositories/matches";

/**
 * Public live-score feed for the scoreboard page (REQ-HOME-005).
 *
 * Authoritative JSON snapshot for initial render and SSE reconnect recovery.
 * `Cache-Control: no-store` ensures the resync never receives an old score.
 *
 * No authentication — this is public information — and no write methods exist
 * on this route; operators post scores through /api/admin/matches/[id]/score.
 */
export async function GET() {
  try {
    const data = await getLiveAndResults(8);
    return NextResponse.json(
      {
        live: data.live,
        recent: data.recent,
        upcoming: data.upcoming,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("live feed failed", error);
    return NextResponse.json({ error: "server" }, { status: 503 });
  }
}
