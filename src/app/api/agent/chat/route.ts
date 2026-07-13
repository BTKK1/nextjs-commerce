import { NextResponse } from "next/server";
import { z } from "zod";
import { getConversationTranscript, handleChat } from "@/lib/agent/chat-service";

export const dynamic = "force-dynamic";

const visitorRefSchema = z.string().regex(/^anon-[a-zA-Z0-9-]{4,64}$/, "visitorRef must be an anonymous visitor reference");

const schema = z.object({
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
  conversationId: z.string().min(1).max(160),
  productSlug: z.string().min(1).max(160),
  visitorRef: visitorRefSchema,
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = transcriptQuerySchema.parse({
      conversationId: url.searchParams.get("conversationId"),
      productSlug: url.searchParams.get("productSlug"),
      visitorRef: url.searchParams.get("visitorRef"),
    });
    const transcript = getConversationTranscript(query);
    if (!transcript) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(transcript);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid transcript request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const result = await handleChat(payload);
    return NextResponse.json({
      conversationId: result.conversationId,
      productId: result.productId,
      productSlug: result.productSlug,
      answer: result.answer,
      fallbackReason: result.fallbackReason,
      detectedObjection: result.detectedObjection,
      insightsCreated: result.insightsCreated,
      mode: result.mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid agent request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
