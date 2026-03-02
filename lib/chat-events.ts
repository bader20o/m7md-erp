import { EventEmitter } from "node:events";

export type ChatEventName =
  | "message:new"
  | "message:deleted"
  | "conversation:read"
  | "participant:added"
  | "participant:removed";

export type ChatEventEnvelope = {
  id: string;
  name: ChatEventName;
  at: string;
  payload: Record<string, unknown>;
};

type InternalEvent = ChatEventEnvelope & {
  toUserIds: string[];
};

const emitter = new EventEmitter();
const EVENT_KEY = "chat:event";

export function publishChatEvent(
  name: ChatEventName,
  toUserIds: string[],
  payload: Record<string, unknown>
): void {
  const uniqueUsers = Array.from(new Set(toUserIds));
  if (!uniqueUsers.length) {
    return;
  }

  const event: InternalEvent = {
    id: crypto.randomUUID(),
    name,
    at: new Date().toISOString(),
    payload,
    toUserIds: uniqueUsers
  };
  emitter.emit(EVENT_KEY, event);
}

export function subscribeChatEvents(
  userId: string,
  onEvent: (event: ChatEventEnvelope) => void
): () => void {
  const handler = (event: InternalEvent): void => {
    if (!event.toUserIds.includes(userId)) {
      return;
    }

    onEvent({
      id: event.id,
      name: event.name,
      at: event.at,
      payload: event.payload
    });
  };

  emitter.on(EVENT_KEY, handler);
  return () => {
    emitter.off(EVENT_KEY, handler);
  };
}
