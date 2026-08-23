import { beforeEach, describe, expect, it, vi } from "vitest";

type PlannedResult = { table: string; data: unknown; error?: unknown };
type QueryCall = { table: string; operations: Array<{ name: string; args: unknown[] }> };

let plans: PlannedResult[] = [];
const calls: QueryCall[] = [];

function createBuilder(call: QueryCall, plan: PlannedResult) {
  const result = () => Promise.resolve({ data: plan.data, error: plan.error ?? null });
  const builder: Record<string, unknown> = {
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return result().then(resolve, reject);
    },
  };
  for (const name of ["select", "eq", "in", "limit"]) {
    builder[name] = (...args: unknown[]) => {
      call.operations.push({ name, args });
      return builder;
    };
  }
  builder.maybeSingle = () => {
    call.operations.push({ name: "maybeSingle", args: [] });
    return result();
  };
  return builder;
}

vi.mock("@/utils/supabase/server", () => ({
  hasSupabaseServiceConfig: () => true,
  createServiceClient: () => ({
    from(table: string) {
      const plan = plans.shift();
      if (!plan || plan.table !== table) throw new Error(`Unexpected table ${table}; expected ${plan?.table ?? "nothing"}`);
      const call: QueryCall = { table, operations: [] };
      calls.push(call);
      return createBuilder(call, plan);
    },
  }),
}));

describe("commerce catalog continuity", () => {
  beforeEach(() => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    calls.length = 0;
    plans = [
      { table: "merchants", data: null },
      { table: "platform_integrations", data: { merchant_id: "merchant-1" } },
      { table: "merchants", data: { id: "merchant-1", public_key: "merchant-key", status: "active", display_name: "Nbeh Store", platform_type: "salla" } },
      { table: "products", data: null },
      { table: "products", data: { id: "product-1", merchant_id: "merchant-1", external_id: "674788844", platform: "salla", slug: "salla-674788844", name: "فستان", price: 174, availability: "In stock" } },
      { table: "products", data: [{ id: "product-1", merchant_id: "merchant-1", external_id: "674788844", platform: "salla", slug: "salla-674788844", name: "فستان", price: 174, availability: "In stock" }] },
      { table: "dashboard_settings", data: null },
      { table: "guardrails", data: [] },
      { table: "platform_integrations", data: [{ id: "integration-1", merchant_id: "merchant-1", provider: "salla", status: "pending", external_store_id: "1583872632" }] },
    ];
  });

  it("serves synchronized products while a commerce integration is pending or recoverable", async () => {
    const { loadSellerKnowledgeForProduct } = await import("@/lib/knowledge/seller-knowledge");
    const knowledge = await loadSellerKnowledgeForProduct("674788844", "1583872632");

    expect(knowledge).toMatchObject({ provider: "salla", currentProduct: { externalId: "674788844", name: "فستان" } });
    const integrationLookup = calls.find((call) => call.table === "platform_integrations" && call.operations.some((operation) => operation.name === "limit"));
    expect(integrationLookup?.operations).toContainEqual({ name: "in", args: ["status", ["connected", "pending", "error"]] });
  });
});
