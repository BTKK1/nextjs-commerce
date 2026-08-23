import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/agent/chat/route";
import { loadDatabase, resetDatabaseForTests } from "@/lib/storage/json-store";
import { createSeedDatabase } from "@/lib/storage/seed";

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeVercelRequest(body: unknown) {
  return new Request("https://nbeh.io/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.42" },
    body: JSON.stringify(body),
  });
}

function makeTranscriptRequest(params: Record<string, string>) {
  return new Request(`http://localhost:3000/api/agent/chat?${new URLSearchParams(params).toString()}`);
}

describe("agent API route", () => {
  beforeEach(() => {
    process.env.AGENT_MODE = "live";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.DEMO_PERSISTENCE = "memory";
    process.env.SUPABASE_AGENT_ENABLED = "false";
    resetDatabaseForTests(createSeedDatabase());
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      const systemPrompt = body.messages[0]?.content ?? "";
      const answer = systemPrompt.includes('"currentProductName": "Everyday Leather Tote"')
        ? "Everyday Leather Tote is $320. It offers full-grain leather, a padded laptop sleeve, and a secure zip top."
        : "Atelier Wool Coat uses 70% Wool and 30% Cashmere for warmth, with a relaxed silhouette and clean drape for winter layering.";
      return new Response(JSON.stringify({ choices: [{ message: { content: answer } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a conversation, logs messages, and returns a grounded answer", async () => {
    const response = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "Is this warm enough for winter?",
        visitorRef: "anon-api-test",
        pageContext: {
          path: "/product/atelier-wool-coat",
          title: "Atelier Wool Coat | Maison Vert",
          productName: "Atelier Wool Coat",
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      conversationId: string;
      answer: string;
      mode: string;
      productSlug: string;
      provider?: string;
      model?: string;
      providerRoute?: string;
      promptTokens?: number;
    };
    expect(payload.answer).toContain("Atelier Wool Coat");
    expect(payload.productSlug).toBe("atelier-wool-coat");
    expect(payload.mode).toBe("live");
    expect(payload.provider).toBeUndefined();
    expect(payload.model).toBeUndefined();
    expect(payload.providerRoute).toBeUndefined();
    expect(payload.promptTokens).toBeUndefined();

    const db = loadDatabase();
    const conversation = db.conversations.find((record) => record.id === payload.conversationId);
    expect(conversation).toBeTruthy();
    const storedMessages = db.messages.filter((message) => message.conversationId === payload.conversationId);
    expect(storedMessages).toHaveLength(3);
    expect(storedMessages[0]).toMatchObject({
      role: "assistant",
      content: expect.stringContaining("Atelier Wool Coat"),
    });
  });

  it("returns the full backend transcript for the matching anonymous visitor", async () => {
    const first = await POST(
      makeRequest({
        productSlug: "everyday-leather-tote",
        message: "What is the price?",
        visitorRef: "anon-transcript-owner",
        locale: "en",
        pageContext: {
          path: "/product/everyday-leather-tote",
          title: "Everyday Leather Tote | Maison Vert",
          productName: "Everyday Leather Tote",
        },
      }),
    );
    expect(first.status).toBe(200);
    const firstPayload = (await first.json()) as { conversationId: string };

    const transcript = await GET(
      makeTranscriptRequest({
        conversationId: firstPayload.conversationId,
        productSlug: "everyday-leather-tote",
        visitorRef: "anon-transcript-owner",
      }),
    );
    expect(transcript.status).toBe(200);
    const payload = (await transcript.json()) as {
      conversationId: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.conversationId).toBe(firstPayload.conversationId);
    expect(payload.messages.map((message) => message.role)).toEqual(["assistant", "user", "assistant"]);
    expect(payload.messages[0].content).toContain("Everyday Leather Tote");
    expect(payload.messages[1].content).toBe("What is the price?");
    expect(payload.messages[2].content).toContain("$320");

    const wrongVisitor = await GET(
      makeTranscriptRequest({
        conversationId: firstPayload.conversationId,
        productSlug: "everyday-leather-tote",
        visitorRef: "anon-transcript-other",
      }),
    );
    expect(wrongVisitor.status).toBe(400);
  });

  it("uses the stored transcript as live-model memory for follow-up questions", async () => {
    const first = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "I need something warm for work.",
        visitorRef: "anon-memory-owner",
      }),
    );
    const firstPayload = (await first.json()) as { conversationId: string; answer: string };

    const second = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "Which option fits that need best?",
        visitorRef: "anon-memory-owner",
        conversationId: firstPayload.conversationId,
      }),
    );

    expect(second.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const lastRequest = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    const body = JSON.parse(String(lastRequest.body)) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages.slice(-4, -2)).toEqual([
      { role: "user", content: "I need something warm for work." },
      { role: "assistant", content: firstPayload.answer },
    ]);
    expect(body.messages.at(-2)).toMatchObject({ role: "system", content: expect.stringContaining("Mandatory current-turn language") });
    const requests = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)) as {
      messages: Array<{ role: string; content: string }>;
    });
    expect(requests.some((request) => request.messages.at(-1)?.content === "Which option fits that need best?")).toBe(true);
  });

  it("logs fallback reason and insight events for missing warranty data", async () => {
    const response = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "Does it include a lifetime warranty?",
        visitorRef: "anon-api-fallback",
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { conversationId: string; fallbackReason?: string; answer: string };
    expect(payload.fallbackReason).toBe("missing_catalog_field");
    expect(payload.answer).toContain("I do not have");

    const db = loadDatabase();
    expect(db.messages.some((message) => message.conversationId === payload.conversationId && message.fallbackReason)).toBe(true);
    expect(db.insights.some((insight) => insight.productSlug === "atelier-wool-coat" && insight.type === "unknown_answer")).toBe(true);
    expect(db.events.some((event) => event.productSlug === "atelier-wool-coat" && event.type === "fallback_triggered")).toBe(true);
  });

  it("keeps an honest live answer while tagging a known catalog-content gap", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "The exact tote dimensions are not listed. It is one size and verified to fit up to a 14-inch laptop." } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await POST(makeRequest({
      productSlug: "everyday-leather-tote",
      message: "What are the exact tote dimensions?",
      visitorRef: "anon-api-known-gap",
    }));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { conversationId: string; fallbackReason?: string; answer: string };
    expect(payload.answer).toContain("exact tote dimensions are not listed");
    expect(payload.fallbackReason).toBe("missing_catalog_field");

    const db = loadDatabase();
    expect(db.insights.some((insight) => insight.productSlug === "everyday-leather-tote" && insight.type === "weak_description")).toBe(true);
    expect(db.insights.some((insight) => insight.productSlug === "everyday-leather-tote" && insight.type === "unknown_answer")).toBe(true);
  });

  it("keeps response language tied to the shopper message while logging storefront locale", async () => {
    const response = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "Does it include a lifetime warranty?",
        visitorRef: "anon-api-ar-page-en-message",
        locale: "ar",
        pageContext: {
          path: "/product/atelier-wool-coat?token=secret",
          productName: "معطف صوف أتلييه",
          locale: "ar",
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { answer: string; fallbackReason?: string };
    expect(payload.fallbackReason).toBe("missing_catalog_field");
    expect(payload.answer).toContain("I do not have");

    const db = loadDatabase();
    expect(db.events.some((event) => event.type === "fallback_triggered" && event.storefrontLocale === "ar")).toBe(true);
  });

  it("returns Arabic fallback text for Arabic shopper messages", async () => {
    const response = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "هل يوجد ضمان مدى الحياة؟",
        visitorRef: "anon-api-ar-message",
        locale: "en",
        pageContext: {
          path: "/product/atelier-wool-coat",
          productName: "Atelier Wool Coat",
          locale: "en",
        },
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { answer: string; fallbackReason?: string };
    expect(payload.fallbackReason).toBe("missing_catalog_field");
    expect(payload.answer).toContain("مو واضحة عندي");
  });

  it("rejects conversation id reuse across anonymous visitors", async () => {
    const first = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "What is the price?",
        visitorRef: "anon-owner",
      }),
    );
    expect(first.status).toBe(200);
    const firstPayload = (await first.json()) as { conversationId: string };

    const second = await POST(
      makeRequest({
        productSlug: "atelier-wool-coat",
        message: "Continue this conversation",
        visitorRef: "anon-other",
        conversationId: firstPayload.conversationId,
      }),
    );
    expect(second.status).toBe(400);
    await expect(second.json()).resolves.toEqual({ error: "Invalid agent request" });
  });

  it("returns a bounded validation error without echoing parser internals", async () => {
    const response = await POST(makeRequest({ productSlug: "atelier-wool-coat", message: "", visitorRef: "not-anonymous" }));
    expect(response.status).toBe(400);
    const payload = await response.json() as { error: string };
    expect(payload).toEqual({ error: "Invalid agent request" });
    expect(payload.error).not.toContain("visitorRef");
  });

  it("fails closed when production Supabase request fingerprinting is not configured", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.DATA_BACKEND = "supabase";
    process.env.VERCEL = "1";
    delete process.env.AGENT_RATE_LIMIT_SECRET;
    const response = await POST(makeVercelRequest({
      productSlug: "atelier-wool-coat",
      message: "Is this warm?",
      visitorRef: "anon-production-limit",
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "The sales assistant is temporarily unavailable" });
  });

  it("returns 429 with Retry-After and a shopper-safe fallback when the budget is exhausted", async () => {
    Object.assign(process.env, { NODE_ENV: "test", DATA_BACKEND: "local" });
    delete process.env.VERCEL;
    const visitorRef = "anon-rate-limit-test";
    for (let index = 0; index < 20; index += 1) {
      const allowed = await POST(makeRequest({
        productSlug: "atelier-wool-coat",
        message: `Is this warm for winter ${index}?`,
        visitorRef,
      }));
      expect(allowed.status).toBe(200);
    }
    const modelCallsBeforeLimit = vi.mocked(fetch).mock.calls.length;
    const limited = await POST(makeRequest({
      productSlug: "atelier-wool-coat",
      message: "Can I ask one more question?",
      visitorRef,
    }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    await expect(limited.json()).resolves.toMatchObject({ rateLimited: true, fallbackReason: "rate_limited" });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(modelCallsBeforeLimit);
  });
});
