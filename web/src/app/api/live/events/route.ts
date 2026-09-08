import { subscribeLiveMatches, type LiveMatchEvent } from "@/server/liveEvents";
import { routeHandler } from "@/server/http/routeHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encodeEvent(event: LiveMatchEvent) {
  return encoder.encode(
    `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
  );
}

/** Public transport only: match mutation and authorization stay in admin routes. */
export async function GET(request: Request) {
  return routeHandler("live events", async () => {
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe?.();
    if (heartbeat) clearInterval(heartbeat);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: LiveMatchEvent | null) => {
        if (closed) return;
        if (!event) {
          cleanup();
          controller.close();
          return;
        }
        controller.enqueue(encodeEvent(event));
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      unsubscribe = await subscribeLiveMatches(send);
      if (closed) {
        unsubscribe();
        return;
      }
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 25_000);
    },
    cancel: cleanup,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
  });
}
