import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSeedDatabase } from "@/lib/storage/seed";

let serviceClient: ReturnType<typeof createFakeClient>;

vi.mock("@/utils/supabase/server", () => ({
  createServiceClient: () => serviceClient,
}));

interface PlannedResult {
  table: string;
  data?: unknown;
  count?: number | null;
  error?: unknown;
}

interface PlannedRpcResult {
  functionName: string;
  data?: unknown;
  error?: unknown;
}

interface QueryCall {
  table: string;
  operations: Array<{ name: string; args: unknown[] }>;
}

function createFakeClient(plans: Array<PlannedResult | PlannedRpcResult>) {
  const calls: QueryCall[] = [];
  return {
    calls,
    rpc(functionName: string, args: Record<string, unknown>) {
      const plan = plans.shift();
      if (!plan || !("functionName" in plan) || plan.functionName !== functionName) {
        throw new Error(`Unexpected Supabase RPC ${functionName}; expected ${plan && "functionName" in plan ? plan.functionName : "nothing"}`);
      }
      calls.push({ table: `rpc:${functionName}`, operations: [{ name: "rpc", args: [args] }] });
      return Promise.resolve({ data: plan.data ?? null, error: plan.error ?? null });
    },
    from(table: string) {
      const plan = plans.shift();
      if (!plan || !("table" in plan) || plan.table !== table) throw new Error(`Unexpected Supabase table ${table}; expected ${plan && "table" in plan ? plan.table : "nothing"}`);
      const call: QueryCall = { table, operations: [] };
      calls.push(call);
      const result = () => Promise.resolve({ data: plan.data ?? null, count: plan.count ?? null, error: plan.error ?? null });
      const builder: Record<string, unknown> = {
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return result().then(resolve, reject); },
      };
      for (const name of ["select", "eq", "in", "gte", "order", "limit", "insert", "upsert", "update"]) {
        builder[name] = (...args: unknown[]) => {
          call.operations.push({ name, args });
          return builder;
        };
      }
      builder.single = () => { call.operations.push({ name: "single", args: [] }); return result(); };
      builder.maybeSingle = () => { call.operations.push({ name: "maybeSingle", args: [] }); return result(); };
      return builder;
    },
  };
}

describe("Supabase agent runtime", () => {
  beforeEach(() => {
    serviceClient = createFakeClient([]);
  });

  it("creates a durable visitor/conversation turn and does not duplicate its welcome on continuation", async () => {
    const { loadSupabaseAgentRuntimeState, persistSupabaseAgentTurn } = await import("@/lib/agent/supabase-runtime");
    const product = createSeedDatabase().products[0];
    const merchantId = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";
    const visitorRef = "anon-runtime-test";

    serviceClient = createFakeClient([
      { table: "conversations", data: null },
      { table: "visitors", data: null },
    ]);
    const initial = await loadSupabaseAgentRuntimeState({ merchantId, productId: product.id, visitorRef });
    expect(initial).toMatchObject({ isNewConversation: true, history: [], rateLimited: false });

    serviceClient = createFakeClient([
      { functionName: "persist_agent_turn_atomic", data: { insights_created: 0 } },
    ]);
    await persistSupabaseAgentTurn({
      merchantId,
      product,
      visitorRef,
      conversationId: initial.conversationId,
      isNewConversation: true,
      storefrontLocale: "en",
      responseLanguage: "en",
      welcomeMessage: "Welcome to Nbeh",
      userMessage: "Is this warm?",
      answer: { text: "Yes, it is warm.", confidence: 0.9, mode: "live", language: "en" },
    });
    const firstWrite = serviceClient.calls.find((call) => call.table === "rpc:persist_agent_turn_atomic");
    const firstArgs = firstWrite?.operations[0]?.args[0] as Record<string, unknown>;
    expect(firstArgs).toMatchObject({
      target_is_new: true,
      target_welcome_message: "Welcome to Nbeh",
      target_user_message: "Is this warm?",
      target_response_language: "en",
    });

    serviceClient = createFakeClient([
      { table: "conversations", data: { id: initial.conversationId, product_id: product.id, metadata_json: { visitor_ref: visitorRef } } },
      { table: "visitors", data: { id: "638b1d36-8b33-4dd0-a03b-bfe7b2afc541" } },
      { table: "messages", data: [{ sender_type: "assistant", content: "Yes, it is warm.", created_at: "2026-08-13T00:00:02Z" }, { sender_type: "visitor", content: "Is this warm?", created_at: "2026-08-13T00:00:01Z" }] },
      { table: "conversations", data: [{ id: initial.conversationId }] },
      { table: "messages", count: 20 },
    ]);
    const continued = await loadSupabaseAgentRuntimeState({ conversationId: initial.conversationId, merchantId, productId: product.id, visitorRef });
    expect(continued.isNewConversation).toBe(false);
    expect(continued.rateLimited).toBe(true);
    expect(continued.history).toEqual([{ role: "user", content: "Is this warm?" }, { role: "assistant", content: "Yes, it is warm." }]);

    serviceClient = createFakeClient([
      { functionName: "persist_agent_turn_atomic", data: { insights_created: 0 } },
    ]);
    await persistSupabaseAgentTurn({
      merchantId,
      product,
      visitorRef,
      conversationId: initial.conversationId,
      isNewConversation: false,
      responseLanguage: "en",
      welcomeMessage: "Welcome to Nbeh",
      userMessage: "Which size?",
      answer: { text: "Tell me your usual fit.", confidence: 0.8, mode: "live", language: "en" },
    });
    const continuedWrite = serviceClient.calls.find((call) => call.table === "rpc:persist_agent_turn_atomic");
    const continuedArgs = continuedWrite?.operations[0]?.args[0] as Record<string, unknown>;
    expect(continuedArgs).toMatchObject({
      target_is_new: false,
      target_user_message: "Which size?",
    });
    expect(continuedArgs.target_welcome_message).toBe("Welcome to Nbeh");
  });

  it("rejects a conversation owned by another anonymous visitor", async () => {
    const { loadSupabaseAgentRuntimeState } = await import("@/lib/agent/supabase-runtime");
    serviceClient = createFakeClient([
      { table: "conversations", data: { id: "bf788203-28f2-4899-8e06-7f28323df697", product_id: "b25f5534-9833-4e3a-a05b-a23bcd1c9842", metadata_json: { visitor_ref: "anon-owner" } } },
      { table: "visitors", data: null },
    ]);
    await expect(loadSupabaseAgentRuntimeState({
      conversationId: "bf788203-28f2-4899-8e06-7f28323df697",
      merchantId: "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781",
      productId: "b25f5534-9833-4e3a-a05b-a23bcd1c9842",
      visitorRef: "anon-attacker",
    })).rejects.toThrow("Conversation does not belong");
  });

  it("shares an atomic fingerprint budget across rotated visitor references", async () => {
    const { loadSupabaseAgentRuntimeState } = await import("@/lib/agent/supabase-runtime");
    const merchantId = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";
    const productId = "b25f5534-9833-4e3a-a05b-a23bcd1c9842";
    const requestFingerprint = `rfp_v1_${"a".repeat(64)}`;

    serviceClient = createFakeClient([
      { functionName: "consume_request_rate_limit", data: [{ allowed: true, retry_after_seconds: 0, current_count: 20 }] },
      { table: "conversations", data: null },
      { table: "visitors", data: null },
    ]);
    const allowed = await loadSupabaseAgentRuntimeState({ merchantId, productId, visitorRef: "anon-rotated-one", requestFingerprint });
    expect(allowed.rateLimited).toBe(false);

    serviceClient = createFakeClient([
      { functionName: "consume_request_rate_limit", data: [{ allowed: false, retry_after_seconds: 42, current_count: 21 }] },
      { table: "conversations", data: null },
      { table: "visitors", data: null },
    ]);
    const denied = await loadSupabaseAgentRuntimeState({ merchantId, productId, visitorRef: "anon-rotated-two", requestFingerprint });
    expect(denied).toMatchObject({ rateLimited: true, retryAfterSeconds: 42 });
    expect(serviceClient.calls[0]).toMatchObject({
      table: "rpc:consume_request_rate_limit",
      operations: [{ name: "rpc", args: [expect.objectContaining({ target_scope: "shopper_chat", target_fingerprint_hash: requestFingerprint })] }],
    });
  });
});
