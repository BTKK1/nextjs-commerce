"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Eraser, MessageCircle, Send, X } from "lucide-react";
import { formatTemplate, storeCopy, type StoreLocale } from "@/components/saleh-demo/store-i18n";
import { buildAgentWelcomeMessage } from "@/lib/agent/welcome";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  fallbackReason?: string;
  createdAt?: string;
}

interface AgentMemory {
  latestUserMessage?: string;
  latestAssistantReply?: string;
  summary?: string;
  conversationId?: string;
  productSlug?: string;
  productName?: string;
  locale?: StoreLocale;
  updatedAt?: number;
}

interface AgentWidgetProps {
  productSlug: string;
  productName: string;
  locale?: StoreLocale;
  defaultOpen?: boolean;
  placement?: "start" | "end";
}

const MAX_STORED_MESSAGES = 30;
const STORAGE_PREFIX = "maison-vert-agent";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getPageContext(productName: string, locale: StoreLocale) {
  return {
    url: window.location.href,
    path: window.location.pathname,
    title: document.title,
    productName,
    locale,
  };
}

function getStorageKey(productSlug: string) {
  return `${STORAGE_PREFIX}:${productSlug}`;
}

function getStorageKeys(productSlug: string) {
  return {
    state: getStorageKey(productSlug),
    sessionId: `${STORAGE_PREFIX}:session-id:${productSlug}`,
    memory: `${STORAGE_PREFIX}:memory:${productSlug}`,
    messages: `${STORAGE_PREFIX}:messages:${productSlug}`,
  };
}

function getLegacyStorageKeys(productSlug: string, locale: StoreLocale) {
  return [`${STORAGE_PREFIX}:${locale}:${productSlug}`];
}

function readSessionFirst(key: string, legacyKeys: string[] = []) {
  if (typeof window === "undefined") return null;
  try {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue !== null) return sessionValue;

    for (const legacyKey of legacyKeys) {
      const legacySessionValue = window.sessionStorage.getItem(legacyKey);
      if (legacySessionValue !== null) {
        window.sessionStorage.setItem(key, legacySessionValue);
        window.sessionStorage.removeItem(legacyKey);
        window.localStorage.removeItem(legacyKey);
        return legacySessionValue;
      }
    }

    const legacyValue = window.localStorage.getItem(key);
    if (legacyValue !== null) {
      window.sessionStorage.setItem(key, legacyValue);
      window.localStorage.removeItem(key);
      return legacyValue;
    }

    for (const legacyKey of legacyKeys) {
      const legacyLocalValue = window.localStorage.getItem(legacyKey);
      if (legacyLocalValue !== null) {
        window.sessionStorage.setItem(key, legacyLocalValue);
        window.localStorage.removeItem(legacyKey);
        return legacyLocalValue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeSessionFirst(key: string, value: string, legacyKeys: string[] = []) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
    for (const legacyKey of legacyKeys) {
      window.sessionStorage.removeItem(legacyKey);
      window.localStorage.removeItem(legacyKey);
    }
  } catch {
    // Storage can be unavailable in hardened/private browsing sessions.
  }
}

function removeSessionFirst(key: string, legacyKeys: string[] = []) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
    for (const legacyKey of legacyKeys) {
      window.sessionStorage.removeItem(legacyKey);
      window.localStorage.removeItem(legacyKey);
    }
  } catch {
    // Storage can be unavailable in hardened/private browsing sessions.
  }
}

function getVisitorRef() {
  const key = "saleh-demo-visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `anon-${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function initialAssistantMessage(productName: string, locale: StoreLocale): ChatMessage {
  return {
    role: "assistant",
    content: buildAgentWelcomeMessage(productName, locale),
    createdAt: new Date().toISOString(),
  };
}

function normalizeStoredMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChatMessage>;
  if (candidate.role !== "assistant" && candidate.role !== "user") return null;
  const content = String(candidate.content || "").trim().slice(0, 2400);
  if (!content) return null;
  return {
    role: candidate.role,
    content,
    fallbackReason: candidate.fallbackReason ? String(candidate.fallbackReason).slice(0, 120) : undefined,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt.slice(0, 80) : undefined,
  };
}

function normalizeStoredMemory(value: unknown): AgentMemory | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AgentMemory>;
  return {
    latestUserMessage: candidate.latestUserMessage ? String(candidate.latestUserMessage).slice(0, 1500) : undefined,
    latestAssistantReply: candidate.latestAssistantReply ? String(candidate.latestAssistantReply).slice(0, 2400) : undefined,
    summary: candidate.summary ? String(candidate.summary).slice(0, 2400) : undefined,
    conversationId: candidate.conversationId ? String(candidate.conversationId).slice(0, 160) : undefined,
    productSlug: candidate.productSlug ? String(candidate.productSlug).slice(0, 160) : undefined,
    productName: candidate.productName ? String(candidate.productName).slice(0, 160) : undefined,
    locale: candidate.locale === "ar" ? "ar" : candidate.locale === "en" ? "en" : undefined,
    updatedAt: Number.isFinite(Number(candidate.updatedAt)) ? Number(candidate.updatedAt) : undefined,
  };
}

function readStoredSessionId(productSlug: string, locale: StoreLocale) {
  const keys = getStorageKeys(productSlug);
  const existing = readSessionFirst(keys.sessionId);
  if (existing) return existing.slice(0, 160);
  const stateRaw = readSessionFirst(keys.state, getLegacyStorageKeys(productSlug, locale));
  if (stateRaw) {
    try {
      const parsed = JSON.parse(stateRaw);
      if (typeof parsed?.sessionId === "string" && parsed.sessionId) {
        writeSessionFirst(keys.sessionId, parsed.sessionId.slice(0, 160));
        return parsed.sessionId.slice(0, 160);
      }
    } catch {
      // Ignore malformed legacy state and create a new session.
    }
  }
  const created = createSessionId();
  writeSessionFirst(keys.sessionId, created);
  return created;
}

function readStoredMemory(productSlug: string): AgentMemory | null {
  const keys = getStorageKeys(productSlug);
  try {
    const parsed = JSON.parse(readSessionFirst(keys.memory) || "null");
    return normalizeStoredMemory(parsed);
  } catch {
    removeSessionFirst(keys.memory);
    return null;
  }
}

function writeStoredMemory(productSlug: string, memory: AgentMemory | null) {
  const keys = getStorageKeys(productSlug);
  if (!memory) {
    removeSessionFirst(keys.memory);
    return;
  }
  writeSessionFirst(keys.memory, JSON.stringify(normalizeStoredMemory(memory)));
}

function mergeAgentMemory(current: AgentMemory | null, partial: AgentMemory): AgentMemory {
  const latestUserMessage = partial.latestUserMessage ?? current?.latestUserMessage ?? "";
  const latestAssistantReply = partial.latestAssistantReply ?? current?.latestAssistantReply ?? "";
  const summarySeed = [current?.summary, latestUserMessage, latestAssistantReply]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-2400);

  return {
    ...current,
    ...partial,
    latestUserMessage,
    latestAssistantReply,
    summary: partial.summary ?? summarySeed,
    updatedAt: Date.now(),
  };
}

function readStoredAgentState(productSlug: string, productName: string, locale: StoreLocale) {
  const keys = getStorageKeys(productSlug);
  const memory = readStoredMemory(productSlug);

  try {
    const rawMessages = JSON.parse(readSessionFirst(keys.messages) || "[]");
    const messages = Array.isArray(rawMessages)
      ? rawMessages
        .map(normalizeStoredMessage)
        .filter((message): message is ChatMessage => Boolean(message))
        .slice(-MAX_STORED_MESSAGES)
      : [];
    const hasUserTurn = messages.some((message) => message.role === "user");
    if (hasUserTurn) {
      return {
        conversationId: memory?.conversationId,
        sessionId: readStoredSessionId(productSlug, locale),
        memory,
        messages,
      };
    }
  } catch {
    removeSessionFirst(keys.messages);
  }

  try {
    const parsed = JSON.parse(readSessionFirst(keys.state, getLegacyStorageKeys(productSlug, locale)) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.productSlug !== productSlug) return null;
    const rawMessages: unknown[] = Array.isArray(parsed.messages) ? parsed.messages : [];
    const messages = rawMessages
      .map(normalizeStoredMessage)
      .filter((message): message is ChatMessage => Boolean(message))
      .slice(-MAX_STORED_MESSAGES);
    const hasUserTurn = messages.some((message) => message?.role === "user");
    if (!hasUserTurn) return null;
    const parsedMemory = normalizeStoredMemory(parsed.memory) ?? memory;
    return {
      conversationId: typeof parsed.conversationId === "string" ? parsed.conversationId.slice(0, 160) : undefined,
      sessionId: readStoredSessionId(productSlug, locale),
      memory: parsedMemory,
      visitorRef: typeof parsed.visitorRef === "string" ? parsed.visitorRef.slice(0, 80) : undefined,
      messages: messages.length ? (messages as ChatMessage[]) : [initialAssistantMessage(productName, locale)],
    };
  } catch {
    removeSessionFirst(keys.state, getLegacyStorageKeys(productSlug, locale));
    return null;
  }
}

function writeStoredAgentState(
  productSlug: string,
  productName: string,
  locale: StoreLocale,
  sessionId: string,
  conversationId: string | undefined,
  memory: AgentMemory | null,
  messages: ChatMessage[],
  open: boolean,
) {
  const keys = getStorageKeys(productSlug);
  const safeMessages = messages.map(normalizeStoredMessage).filter(Boolean).slice(-MAX_STORED_MESSAGES);
  writeSessionFirst(keys.sessionId, sessionId || createSessionId());
  writeSessionFirst(keys.messages, JSON.stringify(safeMessages), getLegacyStorageKeys(productSlug, locale));
  writeStoredMemory(productSlug, memory);
  writeSessionFirst(
    keys.state,
    JSON.stringify({
      version: 3,
      productSlug,
      productName,
      locale,
      sessionId,
      visitorRef: getVisitorRef(),
      conversationId: conversationId || "",
      memory: normalizeStoredMemory(memory),
      messages: safeMessages,
      pageUrl: typeof window === "undefined" ? "" : window.location.href,
      open,
      lastSyncedAt: conversationId ? Date.now() : null,
      updatedAt: Date.now(),
    }),
    getLegacyStorageKeys(productSlug, locale),
  );
}

function transcriptText(messages: ChatMessage[]) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Agent" : "User"}: ${message.content.trim()}`)
    .filter((line) => line.length > "User:".length)
    .join("\n\n");
}

function TypewriterText({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  return <AnimatedTypewriterText text={text} />;
}

function AnimatedTypewriterText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    let index = 0;
    const step = Math.max(1, Math.ceil(text.length / 140));
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + step);
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <>
      {visibleText}
      {visibleText.length < text.length ? (
        <span className="ml-0.5 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-current align-baseline opacity-70" />
      ) : null}
    </>
  );
}

function isFreshMessage(message: ChatMessage) {
  if (!message.createdAt) return false;
  const createdAt = Date.parse(message.createdAt);
  return Number.isFinite(createdAt) && Date.now() - createdAt < 8000;
}

export function AgentWidget({ productSlug, productName, locale = "en", defaultOpen = false, placement = "end" }: AgentWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialAssistantMessage(productName, locale)]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatOpenLoggedRef = useRef(false);
  const restoredRef = useRef(false);
  const lastHydratedConversationRef = useRef<string | undefined>(undefined);
  const copy = storeCopy[locale].agent;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedSessionId = readStoredSessionId(productSlug, locale);
      setSessionId(storedSessionId);
      const stored = readStoredAgentState(productSlug, productName, locale);
      if (stored) {
        setSessionId(stored.sessionId || storedSessionId);
        setConversationId(stored.conversationId);
        setMemory(stored.memory ?? readStoredMemory(productSlug));
        setMessages(stored.messages);
        lastHydratedConversationRef.current = stored.conversationId;
      } else {
        setConversationId(undefined);
        setMemory(readStoredMemory(productSlug));
        setMessages([initialAssistantMessage(productName, locale)]);
        lastHydratedConversationRef.current = undefined;
      }
      restoredRef.current = true;
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [locale, productName, productSlug]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const mobileMedia = window.matchMedia("(max-width: 640px)");
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    if (mobileMedia.matches) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    const visitorRef = getVisitorRef();
    void fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "widget_impression", productSlug, visitorRef, locale }),
    }).catch(() => undefined);
  }, [locale, productSlug]);

  useEffect(() => {
    if (!hydrated || !restoredRef.current) return;
    writeStoredAgentState(productSlug, productName, locale, sessionId || readStoredSessionId(productSlug, locale), conversationId, memory, messages, open);
  }, [conversationId, hydrated, locale, memory, messages, open, productName, productSlug, sessionId]);

  useEffect(() => {
    if (!hydrated || !conversationId || lastHydratedConversationRef.current === `${conversationId}:backend`) return;
    if (messages.some((message) => message.role === "user")) return;

    const controller = new AbortController();
    const visitorRef = getVisitorRef();
    const query = new URLSearchParams({ conversationId, productSlug, visitorRef });

    fetch(`/api/agent/chat?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { messages?: ChatMessage[]; conversationId?: string };
      })
      .then((payload) => {
        if (!payload?.messages?.length) return;
        const backendMessages = payload.messages
          .map(normalizeStoredMessage)
          .filter((message): message is ChatMessage => Boolean(message));
        if (!backendMessages.length) return;

        setMessages((current) => {
          const currentUserTurns = current.filter((message) => message.role === "user").length;
          const backendUserTurns = backendMessages.filter((message) => message.role === "user").length;
          if (currentUserTurns > backendUserTurns) return current;
          return backendMessages;
        });
        if (payload.conversationId) setConversationId(payload.conversationId);
        setMemory((current) => mergeAgentMemory(current, { conversationId: payload.conversationId, productSlug, productName, locale }));
        lastHydratedConversationRef.current = `${conversationId}:backend`;
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [conversationId, hydrated, messages, productSlug]);

  useEffect(() => {
    if (!open || chatOpenLoggedRef.current) return;
    chatOpenLoggedRef.current = true;
    void fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat_opened", productSlug, visitorRef: getVisitorRef(), locale }),
    }).catch(() => undefined);
  }, [locale, open, productSlug]);

  useEffect(() => {
    if (!open) return;
    if (messages.length <= 1 && !isSending) return;
    const messagesElement = messagesRef.current;
    if (messagesElement) {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }, [isSending, messages, open]);

  function resetChat() {
    const keys = getStorageKeys(productSlug);
    removeSessionFirst(keys.state, getLegacyStorageKeys(productSlug, locale));
    removeSessionFirst(keys.messages, getLegacyStorageKeys(productSlug, locale));
    removeSessionFirst(keys.memory);
    removeSessionFirst(keys.sessionId);
    const nextSessionId = createSessionId();
    writeSessionFirst(keys.sessionId, nextSessionId);
    setSessionId(nextSessionId);
    setMemory(null);
    setConversationId(undefined);
    setInput("");
    setMessages([initialAssistantMessage(productName, locale)]);
  }

  function openChat() {
    setOpen(true);
  }

  function downloadConversation() {
    const text = transcriptText(messages) || `Agent: ${initialAssistantMessage(productName, locale).content}`;
    const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `maison-vert-agent-${productSlug}-${date}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanInput = input.trim();
    if (!cleanInput || isSending) return;

    setMessages((current) => [...current, { role: "user", content: cleanInput, createdAt: new Date().toISOString() }]);
    setInput("");
    setIsSending(true);
    const conversationHistory = messages
      .map(normalizeStoredMessage)
      .filter((message): message is ChatMessage => Boolean(message))
      .slice(-MAX_STORED_MESSAGES);
    const activeSessionId = sessionId || readStoredSessionId(productSlug, locale);
    if (!sessionId) setSessionId(activeSessionId);
    const memoryWithUser = mergeAgentMemory(memory, {
      latestUserMessage: cleanInput,
      conversationId,
      productSlug,
      productName,
      locale,
    });
    setMemory(memoryWithUser);

    try {
      const abortController = new AbortController();
      const abortTimer = window.setTimeout(() => abortController.abort(), 50_000);
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        signal: abortController.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug,
          message: cleanInput,
          conversationId,
          visitorRef: getVisitorRef(),
          sessionId: activeSessionId,
          conversationHistory,
          memory: memoryWithUser,
          locale,
          pageContext: getPageContext(productName, locale),
        }),
      });
      window.clearTimeout(abortTimer);
      const payload = (await response.json()) as {
        conversationId?: string;
        answer?: string;
        fallbackReason?: string;
      };

      if (!response.ok || !payload.answer) {
        throw new Error("Agent request failed");
      }

      setConversationId(payload.conversationId);
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: payload.answer ?? "",
        fallbackReason: payload.fallbackReason,
        createdAt: new Date().toISOString(),
      };
      setMemory((current) => mergeAgentMemory(current, {
        latestUserMessage: cleanInput,
        latestAssistantReply: assistantMessage.content,
        conversationId: payload.conversationId,
        productSlug,
        productName,
        locale,
      }));
      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch {
      setInput((current) => current || cleanInput);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: copy.fallback,
        fallbackReason: "model_error",
        createdAt: new Date().toISOString(),
      };
      setMemory((current) => mergeAgentMemory(current, {
        latestUserMessage: cleanInput,
        latestAssistantReply: errorMessage.content,
        conversationId,
        productSlug,
        productName,
        locale,
      }));
      setMessages((current) => [
        ...current,
        errorMessage,
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const startPlacement =
    "left-[max(24px,env(safe-area-inset-left))] max-[480px]:left-[max(10px,env(safe-area-inset-left))] min-[481px]:max-[599px]:left-[max(12px,env(safe-area-inset-left))] min-[600px]:max-[1180px]:left-[max(24px,env(safe-area-inset-left))] data-[open=true]:max-[480px]:right-[max(10px,env(safe-area-inset-right))]";
  const rootPlacement =
    placement === "start"
      ? startPlacement
      : locale === "ar"
        ? startPlacement
        : "right-[max(24px,env(safe-area-inset-right))] max-[480px]:right-[max(10px,env(safe-area-inset-right))] min-[481px]:max-[599px]:right-[max(12px,env(safe-area-inset-right))] min-[600px]:max-[1180px]:right-[max(24px,env(safe-area-inset-right))] data-[open=true]:max-[480px]:left-[max(10px,env(safe-area-inset-left))]";
  const isStartPlacement = placement === "start" || locale === "ar";
  const rootAlignment = isStartPlacement ? "items-start" : "items-end";
  const originPlacement = isStartPlacement ? "origin-bottom-left" : "origin-bottom-right";

  return (
    <div
      className={`pointer-events-none fixed bottom-[max(24px,env(safe-area-inset-bottom))] z-[90] flex w-[clamp(340px,34vw,440px)] max-w-[calc(100dvw-32px)] flex-col ${rootAlignment} max-[480px]:bottom-[max(88px,env(safe-area-inset-bottom))] max-[480px]:w-auto max-[480px]:max-w-[calc(100dvw-20px)] min-[481px]:max-[599px]:bottom-[max(12px,env(safe-area-inset-bottom))] min-[481px]:max-[599px]:w-[min(380px,calc(100dvw-24px))] min-[600px]:max-[1180px]:bottom-[max(24px,env(safe-area-inset-bottom))] min-[600px]:max-[1180px]:w-[clamp(420px,56vw,480px)] min-[600px]:max-[1180px]:max-w-[calc(100dvw-48px)] data-[open=true]:max-[480px]:bottom-[max(10px,env(safe-area-inset-bottom))] data-[open=true]:max-[480px]:w-[calc(100dvw-20px)] data-[open=true]:max-[480px]:max-w-[calc(100dvw-20px)] ${rootPlacement}`}
      data-testid="agent-widget"
      data-hydrated={hydrated ? "true" : "false"}
      data-open={open ? "true" : "false"}
      data-sending={isSending ? "true" : "false"}
      data-dir={locale === "ar" ? "rtl" : "ltr"}
      data-locale={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {open ? (
        <section className={`pointer-events-auto flex h-[clamp(620px,72dvh,720px)] max-h-[min(720px,calc(100dvh-96px))] w-full ${originPlacement} flex-col overflow-hidden rounded-[22px] border border-[#c9ddd6] bg-white/95 shadow-[0_22px_52px_rgba(10,15,20,0.16)] backdrop-blur-xl max-[480px]:fixed max-[480px]:bottom-[max(10px,env(safe-area-inset-bottom))] max-[480px]:left-[max(10px,env(safe-area-inset-left))] max-[480px]:right-[max(10px,env(safe-area-inset-right))] max-[480px]:h-[min(680px,calc(100dvh-80px))] max-[480px]:max-h-[calc(100dvh-80px)] max-[480px]:w-[calc(100dvw-20px)] max-[480px]:max-w-[calc(100dvw-20px)] max-[480px]:rounded-[24px] min-[481px]:max-[599px]:h-[min(680px,calc(100dvh-80px))] min-[481px]:max-[599px]:max-h-[calc(100dvh-80px)] min-[481px]:max-[599px]:rounded-[24px] min-[600px]:max-[1180px]:h-[min(720px,calc(100dvh-96px))] min-[600px]:max-[1180px]:max-h-[calc(100dvh-96px)]`}>
          <div className="relative shrink-0 border-b border-[#d6e4df] bg-white/90 px-3.5 py-3 max-[480px]:sticky max-[480px]:top-0 max-[480px]:z-10 max-[480px]:px-3 max-[480px]:pb-2.5 max-[480px]:pt-[18px] max-[480px]:before:absolute max-[480px]:before:left-1/2 max-[480px]:before:top-[7px] max-[480px]:before:h-1 max-[480px]:before:w-[46px] max-[480px]:before:-translate-x-1/2 max-[480px]:before:rounded-full max-[480px]:before:bg-[#5a6b73]/25">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#058f68] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_12px_28px_-18px_rgba(5,143,104,0.9)] transition active:scale-[0.98] max-[480px]:h-[38px] max-[480px]:w-[38px] max-[480px]:rounded-[13px]"
                  onClick={downloadConversation}
                  aria-label="Download conversation transcript"
                  title="Download conversation transcript"
                  data-testid="agent-avatar-download"
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-5 tracking-tight text-[#0a0f14] [overflow-wrap:anywhere] max-[480px]:text-sm">
                    {copy.title}
                  </h2>
                  <p className="mt-0.5 text-sm leading-5 text-[#5a6b73] [overflow-wrap:anywhere] max-[480px]:line-clamp-1 max-[480px]:text-xs">
                    {formatTemplate(copy.productGuide, { product: productName })}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6e4df] bg-white text-[#53656d] shadow-[0_8px_20px_-16px_rgba(10,15,20,0.45)] transition hover:bg-[#f4faf7] hover:text-[#047857] active:scale-[0.98] max-[480px]:h-11 max-[480px]:w-11 max-[480px]:rounded-[14px]"
                  onClick={resetChat}
                  title={copy.clear}
                  aria-label={copy.clear}
                >
                  <Eraser className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d6e4df] bg-white text-[#0a0f14] shadow-[0_8px_20px_-16px_rgba(10,15,20,0.45)] transition hover:bg-[#f4faf7] active:scale-[0.98] max-[480px]:h-11 max-[480px]:w-11 max-[480px]:rounded-[14px]"
                  onClick={() => setOpen(false)}
                  title={copy.close}
                  aria-label={copy.close}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={messagesRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(239,249,244,0.72),rgba(255,255,255,0.92)_40%,rgba(255,255,255,0.96))] px-3.5 py-4 overscroll-contain max-[480px]:px-3 max-[480px]:py-3"
            data-testid="chat-messages"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`chat-message-${message.role}`}
              >
                <div
                  className={`min-w-0 max-w-[86%] rounded-[17px] px-3.5 py-3 text-sm leading-6 shadow-[0_16px_35px_-32px_rgba(10,15,20,0.5)] max-[480px]:max-w-[92%] ${
                    message.role === "user"
                      ? "bg-[#058f68] text-white"
                      : "border border-[#a8d8c9] bg-[#e8f8f1] text-[#203136]"
                  }`}
                >
                  <p className="text-[13px] leading-5 [overflow-wrap:anywhere]">
                    {message.role === "assistant" ? (
                      <TypewriterText key={`${index}-${message.createdAt || ""}-${message.content}`} text={message.content} animate={isFreshMessage(message)} />
                    ) : (
                      message.content
                    )}
                  </p>
                  {message.fallbackReason ? (
                    <p className={`mt-2 text-xs ${message.role === "user" ? "text-white/75" : "text-[#047857]"}`}>
                      {copy.fallbackLabel} {message.fallbackReason}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
            {isSending ? (
              <div
                className="inline-flex rounded-[17px] border border-[#a8d8c9] bg-[#e8f8f1] px-3.5 py-3 text-[13px] leading-5 text-[#496066] shadow-[0_16px_35px_-32px_rgba(10,15,20,0.5)]"
                data-testid="agent-thinking"
              >
                {copy.thinking}
              </div>
            ) : null}
          </div>
          <form
            onSubmit={submit}
            className="shrink-0 border-t border-[#d6e4df] bg-white/95 px-3 py-3 max-[480px]:px-3 max-[480px]:pb-[max(12px,env(safe-area-inset-bottom))] max-[480px]:pt-2.5"
          >
            <label className="sr-only" htmlFor="product-agent-message">
              {copy.askLabel}
            </label>
            <div className="flex min-w-0 items-center gap-2">
              <input
                id="product-agent-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={!hydrated}
                className="focus-ring min-h-11 min-w-0 flex-1 rounded-[13px] border border-[#058f68] bg-white px-3 text-sm leading-5 text-[#0a0f14] outline-none shadow-[inset_0_0_0_2px_rgba(5,143,104,0.08)] placeholder:text-[#8a9a9f] disabled:opacity-60"
                placeholder={copy.placeholder}
                aria-label={copy.askLabel}
                data-testid="agent-input"
              />
              <button
                type="submit"
                disabled={!hydrated || isSending || !input.trim()}
                className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#7dccb9] px-0 text-sm font-semibold text-white transition hover:bg-[#058f68] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4"
                title={copy.send}
                data-testid="agent-send"
              >
                <span className="sr-only">{copy.send}</span>
                <Send className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">{copy.send}</span>
              </button>
            </div>
          </form>
        </section>
      ) : (
        <button
          type="button"
          className={`focus-ring pointer-events-auto flex h-16 w-16 ${originPlacement} items-center justify-center rounded-[19px] bg-[#058f68] text-white shadow-[0_20px_45px_-22px_rgba(5,143,104,0.95)] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:bg-[#047857] active:translate-y-0 active:scale-[0.98] max-[480px]:h-14 max-[480px]:w-14 max-[480px]:rounded-[18px] min-[481px]:max-[1180px]:h-[60px] min-[481px]:max-[1180px]:w-[60px]`}
          onClick={openChat}
          title={copy.open}
          aria-label={copy.open}
          data-testid="agent-chat-toggle"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/30 bg-white/10 max-[480px]:h-[38px] max-[480px]:w-[38px]">
            <MessageCircle className="h-6 w-6 max-[480px]:h-5 max-[480px]:w-5" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
