import { getSession } from "@/lib/auth";
import { requireSession } from "@/lib/rbac";
import { subscribeChatEvents } from "@/lib/chat-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const actor = requireSession(await getSession());
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown): void => {
        const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(":keepalive\n\n"));
      }, 20_000);

      const unsubscribe = subscribeChatEvents(actor.sub, (event) => {
        send(event.name, event);
      });

      send("connected", { at: new Date().toISOString() });

      cleanup = (): void => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          return;
        }
      };
    },
    cancel() {
      cleanup?.();
      return;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
