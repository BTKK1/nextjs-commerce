import type { DemoDatabase } from "@/lib/types";

export function isRateLimited(db: DemoDatabase, visitorRef: string): boolean {
  const oneMinuteAgo = Date.now() - 60_000;
  const recentMessages = db.messages.filter((message) => {
    if (message.role !== "user") return false;
    const conversation = db.conversations.find((item) => item.id === message.conversationId);
    if (conversation?.visitorRef !== visitorRef) return false;
    return new Date(message.createdAt).getTime() >= oneMinuteAgo;
  });

  return recentMessages.length >= 20;
}
