export const DEMO_MERCHANT_ID = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";
export const DEMO_AGENT_CONFIG_ID = "8f856271-421f-4c5f-bbf0-441fa2e3ad39";
export const DEFAULT_PROMPT_VERSION_ID = "f43f9a1c-036f-40b4-8b83-8858e55b13d2";

export function merchantUuidForLegacyId(legacyId?: string | null): string {
  return legacyId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(legacyId)
    ? legacyId
    : DEMO_MERCHANT_ID;
}
