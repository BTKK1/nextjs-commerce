import { NextResponse } from "next/server";
import { z } from "zod";
import { getConversationTranscript, handleChat } from "@/lib/agent/chat-service";
import { deriveRequestFingerprint } from "@/lib/security/request-fingerprint";
import { WIDGET_MERCHANT_KEY_PATTERN } from "@/lib/widget/identity";

export const dynamic = "force-dynamic";

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return {};
    return {
      "Access-Control-Allow-Origin": parsed.origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  } catch {
    return {};
  }
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

const visitorRefSchema = z.string().regex(/^anon-[a-zA-Z0-9-]{4,64}$/, "visitorRef must be an anonymous visitor reference");

const schema = z.object({
  merchantKey: z.string().regex(WIDGET_MERCHANT_KEY_PATTERN).optional(),
  productSlug: z.string().min(1).max(160),
  message: z.string().min(1).max(1500),
  conversationId: z.string().optional(),
  sessionId: z.string().max(160).optional(),
  visitorRef: visitorRefSchema.optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(["assistant", "user"]),
    content: z.string().max(2400),
    fallbackReason: z.string().max(120).optional(),
    createdAt: z.string().max(80).optional(),
  })).max(30).optional(),
  memory: z.record(z.string(), z.unknown()).optional(),
  locale: z.enum(["en", "ar"]).optional(),
  pageContext: z.object({
    url: z.string().max(500).optional(),
    path: z.string().max(240).optional(),
    title: z.string().max(180).optional(),
    productName: z.string().max(160).optional(),
    locale: z.enum(["en", "ar"]).optional()
  }).optional()
});

const transcriptQuerySchema = z.object({
  merchantKey: z.string().regex(WIDGET_MERCHANT_KEY_PATTERN).optional(),
  conversationId: z.string().min(1).max(160),
  productSlug: z.string().min(1).max(160),
  visitorRef: visitorRefSchema,
});

function isInvalidRequest(error: unknown): boolean {
  return error instanceof z.ZodError || error instanceof SyntaxError;
}

function isConversationBoundaryError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Conversation does not belong to this anonymous visitor");
}

function logAgentFailure(error: unknown): void {
  const failure = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error("[nbeh] agent_chat_failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    code: typeof failure.code === "string" ? failure.code.slice(0, 40) : null,
    message: error instanceof Error ? error.message.slice(0, 320) : "Unknown agent failure",
    hint: typeof failure.hint === "string" ? failure.hint.slice(0, 240) : null,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = transcriptQuerySchema.parse({
      conversationId: url.searchParams.get("conversationId"),
      productSlug: url.searchParams.get("productSlug"),
      visitorRef: url.searchParams.get("visitorRef"),
      merchantKey: url.searchParams.get("merchantKey") ?? undefined,
    });
    const transcript = await getConversationTranscript(query);
    if (!transcript) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(transcript);
  } catch (error) {
    if (isInvalidRequest(error) || isConversationBoundaryError(error)) {
      return NextResponse.json({ error: "Invalid transcript request" }, { status: 400 });
    }
    return NextResponse.json({ error: "The conversation service is temporarily unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    const payload = schema.parse(await request.json());
    const result = await handleChat({ ...payload, requestFingerprint: deriveRequestFingerprint(request) });
    const responsePayload = {
      conversationId: result.conversationId,
      productId: result.productId,
      productSlug: result.productSlug,
      answer: result.answer,
      fallbackReason: result.fallbackReason,
      detectedObjection: result.detectedObjection,
      insightsCreated: result.insightsCreated,
      mode: result.mode,
      rateLimited: result.fallbackReason === "rate_limited" ? true : undefined,
    };
    if (result.fallbackReason === "rate_limited") {
      const retryAfter = Math.max(1, result.retryAfterSeconds ?? 60);
      return NextResponse.json(responsePayload, {
        status: 429,
        headers: { ...headers, "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(responsePayload, { headers });
  } catch (error) {
    if (isInvalidRequest(error) || isConversationBoundaryError(error)) {
      return NextResponse.json({ error: "Invalid agent request" }, { status: 400, headers });
    }
    logAgentFailure(error);
    return NextResponse.json({ error: "The sales assistant is temporarily unavailable" }, { status: 503, headers });
  }
}
