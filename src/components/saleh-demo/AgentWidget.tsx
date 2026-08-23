"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Eraser, Send, X } from "lucide-react";
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
  merchantKey?: string;
  merchantName?: string;
  productSlug: string;
  productName: string;
  locale?: StoreLocale;
  defaultOpen?: boolean;
  placement?: "start" | "end";
  trackProductView?: boolean;
}

interface ClientWidgetPreferences {
  tonePreset: "neutral_saudi" | "warm_concise" | "consultative";
  arabicDialect: "white_saudi" | "najdi" | "hijazi" | "gulf" | "modern_standard";
  positionAr: "left" | "right";
  positionEn: "left" | "right";
  autoPopupEnabled: boolean;
  autoPopupDelaySeconds: number;
}

const MAX_STORED_MESSAGES = 30;
const STORAGE_PREFIX = "nbeh-agent";

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

function getVisitorRef(merchantKey: string) {
  const key = `${STORAGE_PREFIX}:visitor:${merchantKey}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `anon-${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function initialAssistantMessage(productName: string, locale: StoreLocale, merchantName?: string, tonePreset?: string, arabicDialect?: string): ChatMessage {
  return {
    role: "assistant",
    content: buildAgentWelcomeMessage(productName, locale, merchantName, { tonePreset, arabicDialect }),
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
  merchantKey: string,
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
      visitorRef: getVisitorRef(merchantKey),
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

function NbehFace({ expression = "ready", className = "" }: { expression?: "ready" | "thinking"; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 42 10 H 78 A 32 32 0 0 1 110 42 V 78 A 32 32 0 0 1 78 110 H 18 A 8 8 0 0 1 10 102 V 42 A 32 32 0 0 1 42 10 Z"
        fill="#5B2EFF"
      />
      {expression === "thinking" ? (
        <>
          <circle className="motion-safe:animate-pulse" cx="46" cy="27" r="3.6" fill="white" />
          <circle className="motion-safe:animate-pulse [animation-delay:150ms]" cx="60" cy="27" r="3.6" fill="white" />
          <circle className="motion-safe:animate-pulse [animation-delay:300ms]" cx="74" cy="27" r="3.6" fill="white" />
          <circle cx="45" cy="55" r="8" fill="white" />
          <circle cx="81" cy="55" r="8" fill="white" />
          <path d="M52 80 Q60 86 68 80" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="42" cy="52" r="9" fill="white" />
          <circle cx="78" cy="52" r="9" fill="white" />
          <path d="M42 76 Q60 90 78 76" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
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

export function AgentWidget({ merchantKey, merchantName, productSlug, productName, locale = "en", defaultOpen = false, placement = "end", trackProductView = false }: AgentWidgetProps) {
  const effectiveMerchantKey = merchantKey ?? process.env.NEXT_PUBLIC_DEMO_MERCHANT_KEY ?? "demo-maison-vert";
  const effectiveMerchantName = merchantName ?? (locale === "ar" ? "المتجر" : "Store");
  const storageScope = `${effectiveMerchantKey}:${productSlug}`;
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [widgetPreferences, setWidgetPreferences] = useState<ClientWidgetPreferences | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const tonePreset = widgetPreferences?.tonePreset;
  const arabicDialect = widgetPreferences?.arabicDialect;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialAssistantMessage(productName, locale, effectiveMerchantName)]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const chatOpenLoggedRef = useRef(false);
  const restoredRef = useRef(false);
  const lastHydratedConversationRef = useRef<string | undefined>(undefined);
  const copy = storeCopy[locale].agent;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/widget/preferences?merchantKey=${encodeURIComponent(effectiveMerchantKey)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as ClientWidgetPreferences : null)
      .then((preferences) => {
        if (!preferences) return;
        setWidgetPreferences(preferences);
        setMessages((current) => current.length === 1 && current[0]?.role === "assistant" && !conversationId
          ? [initialAssistantMessage(productName, locale, effectiveMerchantName, preferences.tonePreset, preferences.arabicDialect)]
          : current);
      })
      .catch(() => undefined)
      .finally(() => setPreferencesLoaded(true));
    return () => controller.abort();
  }, [conversationId, effectiveMerchantKey, effectiveMerchantName, locale, productName]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedSessionId = readStoredSessionId(storageScope, locale);
      setSessionId(storedSessionId);
      const stored = readStoredAgentState(storageScope, productName, locale);
      if (stored) {
        setSessionId(stored.sessionId || storedSessionId);
        setConversationId(stored.conversationId);
        setMemory(stored.memory ?? readStoredMemory(storageScope));
        setMessages(stored.messages);
        lastHydratedConversationRef.current = stored.conversationId;
      } else {
        setConversationId(undefined);
        setMemory(readStoredMemory(storageScope));
        setMessages([initialAssistantMessage(productName, locale, effectiveMerchantName, tonePreset, arabicDialect)]);
        lastHydratedConversationRef.current = undefined;
      }
      restoredRef.current = true;
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [arabicDialect, effectiveMerchantName, locale, productName, storageScope, tonePreset]);

  useEffect(() => {
    if (!hydrated || !preferencesLoaded || defaultOpen || open || !widgetPreferences?.autoPopupEnabled) return;
    const storageKey = `nbeh-agent:auto-popup:${effectiveMerchantKey}:${locale}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
    } catch {
      // Auto popup still works when session storage is unavailable.
    }
    const timer = window.setTimeout(() => {
      setOpen(true);
      try { window.sessionStorage.setItem(storageKey, "shown"); } catch { /* ignored */ }
    }, widgetPreferences.autoPopupDelaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [defaultOpen, effectiveMerchantKey, hydrated, locale, open, preferencesLoaded, widgetPreferences]);

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
    const visitorRef = getVisitorRef(effectiveMerchantKey);
    const eventTypes = trackProductView ? ["product_page_view", "widget_impression"] : ["widget_impression"];
    void Promise.all(eventTypes.map((type) => fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, merchantKey: effectiveMerchantKey, productSlug, visitorRef, locale }),
    }).catch(() => undefined)));
  }, [effectiveMerchantKey, locale, productSlug, trackProductView]);

  useEffect(() => {
    if (!hydrated || !restoredRef.current) return;
    writeStoredAgentState(storageScope, effectiveMerchantKey, productName, locale, sessionId || readStoredSessionId(storageScope, locale), conversationId, memory, messages, open);
  }, [conversationId, effectiveMerchantKey, hydrated, locale, memory, messages, open, productName, sessionId, storageScope]);

  useEffect(() => {
    if (!hydrated || !conversationId || lastHydratedConversationRef.current === `${conversationId}:backend`) return;
    if (messages.some((message) => message.role === "user")) return;

    const controller = new AbortController();
    const visitorRef = getVisitorRef(effectiveMerchantKey);
    const query = new URLSearchParams({ conversationId, merchantKey: effectiveMerchantKey, productSlug, visitorRef });

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
  }, [conversationId, effectiveMerchantKey, hydrated, messages, productName, productSlug]);

  useEffect(() => {
    if (!open || chatOpenLoggedRef.current) return;
    chatOpenLoggedRef.current = true;
    void fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat_opened", merchantKey: effectiveMerchantKey, productSlug, visitorRef: getVisitorRef(effectiveMerchantKey), locale }),
    }).catch(() => undefined);
  }, [effectiveMerchantKey, locale, open, productSlug]);

  useEffect(() => {
    if (!open) return;
    if (messages.length <= 1 && !isSending) return;
    const messagesElement = messagesRef.current;
    if (messagesElement) {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }, [isSending, messages, open]);

  function resetChat() {
    const keys = getStorageKeys(storageScope);
    removeSessionFirst(keys.state, getLegacyStorageKeys(storageScope, locale));
    removeSessionFirst(keys.messages, getLegacyStorageKeys(storageScope, locale));
    removeSessionFirst(keys.memory);
    removeSessionFirst(keys.sessionId);
    const nextSessionId = createSessionId();
    writeSessionFirst(keys.sessionId, nextSessionId);
    setSessionId(nextSessionId);
    setMemory(null);
    setConversationId(undefined);
    setInput("");
    setMessages([initialAssistantMessage(productName, locale, effectiveMerchantName, tonePreset, arabicDialect)]);
  }

  function openChat() {
    setOpen(true);
    try { window.sessionStorage.setItem(`nbeh-agent:auto-popup:${effectiveMerchantKey}:${locale}`, "shown"); } catch { /* ignored */ }
  }

  function downloadConversation() {
    const text = transcriptText(messages) || `Agent: ${initialAssistantMessage(productName, locale, effectiveMerchantName, tonePreset, arabicDialect).content}`;
    const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `nbeh-${productSlug}-${date}.txt`;
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
    const activeSessionId = sessionId || readStoredSessionId(storageScope, locale);
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
          merchantKey: effectiveMerchantKey,
          productSlug,
          message: cleanInput,
          conversationId,
          visitorRef: getVisitorRef(effectiveMerchantKey),
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
        rateLimited?: boolean;
      };

      if ((!response.ok && response.status !== 429) || !payload.answer) {
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
      if (payload.rateLimited) {
        setInput(cleanInput);
      }
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
  const configuredSide = locale === "ar" ? widgetPreferences?.positionAr : widgetPreferences?.positionEn;
  const placeOnLeft = configuredSide ? configuredSide === "left" : placement === "start" || locale === "ar";
  const rootPlacement =
    placeOnLeft
      ? startPlacement
      : "right-[max(24px,env(safe-area-inset-right))] max-[480px]:right-[max(10px,env(safe-area-inset-right))] min-[481px]:max-[599px]:right-[max(12px,env(safe-area-inset-right))] min-[600px]:max-[1180px]:right-[max(24px,env(safe-area-inset-right))] data-[open=true]:max-[480px]:left-[max(10px,env(safe-area-inset-left))]";
  const isStartPlacement = placeOnLeft;
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
        <section className={`pointer-events-auto flex h-[clamp(620px,72dvh,720px)] max-h-[min(720px,calc(100dvh-96px))] w-full ${originPlacement} flex-col overflow-hidden rounded-[24px] border border-[#E4E6EC] bg-white/95 shadow-[0_24px_60px_rgba(11,14,18,0.14),0_12px_34px_rgba(91,46,255,0.08)] backdrop-blur-xl max-[480px]:fixed max-[480px]:bottom-[max(10px,env(safe-area-inset-bottom))] max-[480px]:left-[max(10px,env(safe-area-inset-left))] max-[480px]:right-[max(10px,env(safe-area-inset-right))] max-[480px]:h-[min(680px,calc(100dvh-80px))] max-[480px]:max-h-[calc(100dvh-80px)] max-[480px]:w-[calc(100dvw-20px)] max-[480px]:max-w-[calc(100dvw-20px)] max-[480px]:rounded-[24px] min-[481px]:max-[599px]:h-[min(680px,calc(100dvh-80px))] min-[481px]:max-[599px]:max-h-[calc(100dvh-80px)] min-[481px]:max-[599px]:rounded-[24px] min-[600px]:max-[1180px]:h-[min(720px,calc(100dvh-96px))] min-[600px]:max-[1180px]:max-h-[calc(100dvh-96px)]`}>
          <div className="relative shrink-0 border-b border-[#EFF0F4] bg-white/95 px-3.5 py-3 max-[480px]:sticky max-[480px]:top-0 max-[480px]:z-10 max-[480px]:px-3 max-[480px]:pb-2.5 max-[480px]:pt-[18px] max-[480px]:before:absolute max-[480px]:before:left-1/2 max-[480px]:before:top-[7px] max-[480px]:before:h-1 max-[480px]:before:w-[46px] max-[480px]:before:-translate-x-1/2 max-[480px]:before:rounded-full max-[480px]:before:bg-[#5C6272]/25">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#F7F8FA] p-0.5 shadow-[0_9px_24px_-16px_rgba(91,46,255,0.7)] transition hover:bg-[#EDE8FF] active:scale-[0.98] max-[480px]:h-10 max-[480px]:w-10"
                  onClick={downloadConversation}
                  aria-label={locale === "ar" ? "تنزيل محادثة نبيه" : "Download Nbeh conversation"}
                  title={locale === "ar" ? "تنزيل محادثة نبيه" : "Download Nbeh conversation"}
                  data-testid="agent-avatar-download"
                >
                  <NbehFace className="h-full w-full" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold leading-5 tracking-tight text-[#0B0E12] [overflow-wrap:anywhere] max-[480px]:text-sm">
                    {copy.title}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-5 text-[#5C6272] [overflow-wrap:anywhere] max-[480px]:line-clamp-1 max-[480px]:text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E] shadow-[0_0_0_4px_rgba(34,197,94,0.1)]" aria-hidden="true" />
                    <span>{formatTemplate(copy.productGuide, { product: productName })}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E6EC] bg-white text-[#5C6272] shadow-[0_8px_20px_-16px_rgba(11,14,18,0.45)] transition hover:border-[#CFC5FF] hover:bg-[#F7F5FF] hover:text-[#4A21D6] active:scale-[0.98] max-[480px]:h-11 max-[480px]:w-11 max-[480px]:rounded-[14px]"
                  onClick={resetChat}
                  title={copy.clear}
                  aria-label={copy.clear}
                >
                  <Eraser className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E4E6EC] bg-white text-[#0B0E12] shadow-[0_8px_20px_-16px_rgba(11,14,18,0.45)] transition hover:border-[#CFC5FF] hover:bg-[#F7F5FF] hover:text-[#4A21D6] active:scale-[0.98] max-[480px]:h-11 max-[480px]:w-11 max-[480px]:rounded-[14px]"
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
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(560px_260px_at_88%_-8%,rgba(91,46,255,0.1),transparent_62%),linear-gradient(180deg,#F7F8FA_0%,rgba(255,255,255,0.96)_38%,#FFFFFF_100%)] px-3.5 py-4 overscroll-contain max-[480px]:px-3 max-[480px]:py-3"
            data-testid="chat-messages"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`chat-message-${message.role}`}
              >
                <div
                  className={`min-w-0 max-w-[86%] rounded-[14px] px-3.5 py-3 text-sm leading-6 shadow-[0_16px_35px_-32px_rgba(11,14,18,0.48)] max-[480px]:max-w-[92%] ${
                    message.role === "user"
                      ? "rounded-ee-[4px] bg-[#F1F2F5] text-[#0B0E12]"
                      : "rounded-es-[4px] border border-[#DDD5FF] bg-[#EDE8FF] text-[#2A1580]"
                  }`}
                >
                  <p className="text-[13px] leading-5 [overflow-wrap:anywhere]">
                    {message.role === "assistant" ? (
                      <TypewriterText key={`${index}-${message.createdAt || ""}-${message.content}`} text={message.content} animate={isFreshMessage(message)} />
                    ) : (
                      message.content
                    )}
                  </p>
                </div>
              </div>
            ))}
            {isSending ? (
              <div
                className="inline-flex w-fit items-center gap-2.5 rounded-[14px] rounded-es-[4px] border border-[#DDD5FF] bg-[#EDE8FF] px-3 py-2 text-[13px] leading-5 text-[#4A21D6] shadow-[0_16px_35px_-32px_rgba(11,14,18,0.48)]"
                data-testid="agent-thinking"
              >
                <NbehFace expression="thinking" className="h-8 w-8 shrink-0 motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]" />
                <span>{copy.thinking}</span>
                <span className="inline-flex gap-1" aria-hidden="true">
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B76D9] [animation-delay:-300ms] motion-reduce:animate-none" />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B76D9] [animation-delay:-150ms] motion-reduce:animate-none" />
                  <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B76D9] motion-reduce:animate-none" />
                </span>
              </div>
            ) : null}
          </div>
          <form
            onSubmit={submit}
            className="shrink-0 border-t border-[#EFF0F4] bg-white/95 px-3 py-3 max-[480px]:px-3 max-[480px]:pb-[max(12px,env(safe-area-inset-bottom))] max-[480px]:pt-2.5"
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
                className="focus-ring min-h-11 min-w-0 flex-1 rounded-[12px] border border-[#E2E4EA] bg-[#F7F8FA] px-3 text-sm leading-5 text-[#0B0E12] outline-none transition placeholder:text-[#8A8FA0] focus:border-[#5B2EFF] focus:bg-white focus:shadow-[inset_0_0_0_2px_rgba(91,46,255,0.08)] disabled:opacity-60"
                placeholder={copy.placeholder}
                aria-label={copy.askLabel}
                data-testid="agent-input"
              />
              <button
                type="submit"
                disabled={!hydrated || isSending || !input.trim()}
                className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#5B2EFF] px-0 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(91,46,255,0.28)] transition hover:-translate-y-0.5 hover:bg-[#4A21D6] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none sm:w-auto sm:px-4"
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
          className={`focus-ring pointer-events-auto flex h-[68px] w-[68px] ${originPlacement} items-center justify-center rounded-[22px] border border-white/40 bg-white p-1.5 text-white shadow-[0_20px_45px_-18px_rgba(91,46,255,0.75),0_8px_24px_-18px_rgba(11,14,18,0.6)] ring-1 ring-[#5B2EFF]/10 transition hover:-translate-y-1 hover:shadow-[0_24px_52px_-18px_rgba(91,46,255,0.82)] active:translate-y-0 active:scale-[0.98] max-[480px]:h-[60px] max-[480px]:w-[60px] max-[480px]:rounded-[20px] min-[481px]:max-[1180px]:h-16 min-[481px]:max-[1180px]:w-16`}
          onClick={openChat}
          title={copy.open}
          aria-label={copy.open}
          data-testid="agent-chat-toggle"
        >
          <NbehFace className="h-full w-full drop-shadow-[0_8px_14px_rgba(74,33,214,0.22)]" />
        </button>
      )}
    </div>
  );
}
