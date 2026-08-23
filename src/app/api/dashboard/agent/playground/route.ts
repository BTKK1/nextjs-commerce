import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDashboardIdentity } from "@/lib/auth/require-user";
import { canManageAdvancedAgent } from "@/lib/auth/roles";
import {
  getAgentAdminState,
  runtimeConfigForPromptVersion,
} from "@/lib/agent/config-repository";
import { generateAgentAnswer } from "@/lib/agent/llm-client";
import { getSellerKnowledgeForProduct } from "@/lib/knowledge/seller-knowledge";
import {
  classifyQuestionIntent,
  detectObjection,
  detectWeakDescriptionSignal,
} from "@/lib/insights/extractor";
import { createServiceClient } from "@/utils/supabase/server";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { loadDashboardDatabase } from "@/lib/dashboard/data";
import { evaluateGuardrails } from "@/lib/agent/guardrails";
import type { RuntimeAgentConfig } from "@/lib/agent/config-repository";
import { isSameOriginMutation } from "@/lib/integrations/registry";
import { detectLanguage } from "@/lib/agent/language";
import { resolveDataBackend } from "@/lib/backend/mode";
import { mutateLocalAgentAdminState } from "@/lib/agent/local-admin-store";
import { getCurrentPromptCandidate } from "@/lib/agent/prompt-versioning";

const inputSchema = z.object({
  productSlug: z.string().min(1).max(160),
  message: z.string().min(1).max(1500),
  locale: z.enum(["en", "ar"]).optional(),
  draftVersionId: z.string().uuid().optional(),
});

const saveSchema = z.object({
  productSlug: z.string().min(1).max(160),
  locale: z.enum(["en", "ar"]).optional(),
  message: z.string().min(1).max(1500),
  draftVersionId: z.string().uuid().optional(),
  activeAnswer: z.string().min(1).max(5000),
  draftAnswer: z.string().min(1).max(5000),
  generatedInsights: z.record(z.string(), z.string().nullable()),
});

async function advancedIdentity() {
  const identity = await getDashboardIdentity();
  if (!identity)
    return {
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    } as const;
  if (!canManageAdvancedAgent(identity.role))
    return {
      response: NextResponse.json(
        { error: "Advanced agent access required" },
        { status: 403 },
      ),
    } as const;
  return { identity } as const;
}

async function playgroundAnswer(
  knowledge: NonNullable<ReturnType<typeof getSellerKnowledgeForProduct>>,
  message: string,
  pageContext: {
    path: string;
    title: string;
    productName: string;
    locale: "en" | "ar";
  },
  config: RuntimeAgentConfig,
) {
  const guardrail = evaluateGuardrails(message, knowledge.currentProduct);
  if (!guardrail.allowed)
    return {
      text: guardrail.message,
      fallbackReason: guardrail.reason,
      errorCode: "input_guardrail",
      model: null,
    };
  return generateAgentAnswer(
    knowledge.currentProduct,
    message,
    pageContext,
    knowledge,
    [],
    config,
  );
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  const auth = await advancedIdentity();
  if ("response" in auth) return auth.response;
  const { identity } = auth;
  try {
    const input = inputSchema.parse(await request.json());
    const locale = detectLanguage(input.message);
    const knowledge = getSellerKnowledgeForProduct(
      input.productSlug,
      await loadDashboardDatabase(),
    );
    if (!knowledge)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const state = await getAgentAdminState(identity);
    const currentDraft = getCurrentPromptCandidate(state.versions);
    if (input.draftVersionId && input.draftVersionId !== currentDraft?.id)
      return NextResponse.json(
        {
          error: "This draft was replaced. Refresh to test the current draft.",
        },
        { status: 409 },
      );
    const draft = currentDraft;
    const draftConfig = draft
      ? runtimeConfigForPromptVersion(state.active, draft)
      : state.active;
    const pageContext = {
      path: `${locale === "ar" ? "/ar" : ""}/product/${input.productSlug}`,
      title: `${knowledge.currentProduct.name} | ${knowledge.merchant.name}`,
      productName: knowledge.currentProduct.name,
      locale,
    } as const;
    const [active, candidate] = await Promise.all([
      playgroundAnswer(knowledge, input.message, pageContext, state.active),
      playgroundAnswer(knowledge, input.message, pageContext, draftConfig),
    ]);
    return NextResponse.json({
      active: {
        answer: active.text,
        fallbackReason: active.fallbackReason ?? null,
        guardrailResult: active.errorCode ?? "passed",
        model: active.model,
        version: state.active.versionNumber,
      },
      draft: {
        answer: candidate.text,
        fallbackReason: candidate.fallbackReason ?? null,
        guardrailResult: candidate.errorCode ?? "passed",
        model: candidate.model,
        version: draftConfig.versionNumber,
      },
      context: {
        product: knowledge.currentProduct.name,
        productSlug: input.productSlug,
        source: knowledge.source,
        fields: [
          "price",
          "availability",
          "variants",
          "features",
          "care and shipping",
          "FAQs",
          "objections",
        ],
      },
      generatedInsights: {
        intent: classifyQuestionIntent(input.message),
        objection: detectObjection(input.message) ?? null,
        weakDescriptionSignal:
          detectWeakDescriptionSignal(
            knowledge.currentProduct,
            input.message,
          ) ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid playground request" },
        { status: 400 },
      );
    }
    console.error(
      "[nbeh] playground_compare_failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "The playground is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginMutation(request))
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  const auth = await advancedIdentity();
  if ("response" in auth) return auth.response;
  const { identity } = auth;
  try {
    const input = saveSchema.parse(await request.json());
    const locale = detectLanguage(input.message);
    const state = await getAgentAdminState(identity);
    const product = getSellerKnowledgeForProduct(
      input.productSlug,
      await loadDashboardDatabase(),
    )?.currentProduct;
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const currentDraft = getCurrentPromptCandidate(state.versions);
    if (input.draftVersionId && input.draftVersionId !== currentDraft?.id)
      return NextResponse.json(
        {
          error:
            "This draft was replaced. Refresh to save a comparison for the current draft.",
        },
        { status: 409 },
      );
    const promptVersionId =
      currentDraft && input.draftVersionId === currentDraft.id
        ? currentDraft.id
        : state.active.promptVersionId;
    const qaRunId = randomUUID();
    const qaCaseId = randomUUID();
    const now = new Date().toISOString();
    if (resolveDataBackend() === "local") {
      await mutateLocalAgentAdminState(identity.merchantId, (stored) => {
        stored.qaRuns.unshift({
          id: qaRunId,
          merchant_id: identity.merchantId,
          agent_config_id: state.active.configId,
          prompt_version_id: promptVersionId,
          status: "playground_saved",
          total_conversations: 1,
          total_messages: 3,
          hard_failures: 0,
          report_json: {
            source: "dashboard_playground",
            product_slug: input.productSlug,
            language: locale,
            qa_case_id: qaCaseId,
          },
          created_by: identity.userId,
          completed_at: now,
          created_at: now,
        });
        stored.auditLogs.unshift({
          id: randomUUID(),
          action: "playground_qa_case_saved",
          entity_type: "qa_case",
          entity_id: qaCaseId,
          actor_type: identity.userId ? "user" : "founder",
          created_at: now,
          details_json: {
            qa_run_id: qaRunId,
            prompt_version_id: promptVersionId,
            product_slug: input.productSlug,
          },
        });
      });
      return NextResponse.json({ qaCaseId, qaRunId });
    }
    const supabase = createServiceClient();
    const { error: runError } = await supabase.from("qa_runs").insert({
      id: qaRunId,
      merchant_id: identity.merchantId,
      agent_config_id: state.active.configId,
      prompt_version_id: promptVersionId,
      status: "playground_saved",
      total_conversations: 1,
      total_messages: 3,
      hard_failures: 0,
      report_json: {
        source: "dashboard_playground",
        product_slug: input.productSlug,
        language: locale,
      },
      created_by: identity.userId,
      completed_at: now,
    });
    if (runError) throw runError;
    const { error: caseError } = await supabase.from("qa_cases").insert({
      id: qaCaseId,
      qa_run_id: qaRunId,
      merchant_id: identity.merchantId,
      product_id: product.id,
      language: locale,
      scenario: "dashboard_playground_comparison",
      user_messages: [input.message],
      assistant_messages: [
        { configuration: "active", content: input.activeAnswer },
        { configuration: "draft", content: input.draftAnswer },
      ],
      hard_failures: [],
      findings: input.generatedInsights,
      created_at: now,
    });
    if (caseError) throw caseError;
    await writeAuditLog({
      merchantId: identity.merchantId,
      actorUserId: identity.userId,
      action: "playground_qa_case_saved",
      entityType: "qa_case",
      entityId: qaCaseId,
      details: {
        qa_run_id: qaRunId,
        prompt_version_id: promptVersionId,
        product_slug: input.productSlug,
      },
    });
    return NextResponse.json({ qaCaseId, qaRunId });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid QA case" }, { status: 400 });
    }
    console.error(
      "[nbeh] playground_qa_case_save_failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "The QA case could not be saved" },
      { status: 503 },
    );
  }
}
