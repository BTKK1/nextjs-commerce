import "server-only";
import { createServiceClient } from "@/utils/supabase/server";

export const MAX_AGENT_TOKENS_PER_REQUEST = 50_000;

export interface AgentTokenReservation {
  allowed: boolean;
  reservationId: string | null;
  remainingTokens: number;
}

export async function reserveAgentTokenBudget(merchantId: string, estimatedTokens: number): Promise<AgentTokenReservation> {
  const { data, error } = await createServiceClient().rpc("reserve_agent_token_budget", {
    target_merchant_id: merchantId,
    estimated_tokens: Math.max(1, Math.min(MAX_AGENT_TOKENS_PER_REQUEST, Math.round(estimatedTokens))),
    request_time: new Date().toISOString(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Token budget service returned an invalid response.");
  const value = row as Record<string, unknown>;
  return {
    allowed: value.allowed === true,
    reservationId: typeof value.reservation_id === "string" ? value.reservation_id : null,
    remainingTokens: Math.max(0, Number(value.remaining_tokens ?? 0) || 0),
  };
}

export async function settleAgentTokenBudget(reservationId: string, actualTokens: number | null | undefined, succeeded: boolean): Promise<void> {
  const { error } = await createServiceClient().rpc("settle_agent_token_budget", {
    target_reservation_id: reservationId,
    actual_tokens: Math.max(0, Math.min(MAX_AGENT_TOKENS_PER_REQUEST, Math.round(actualTokens ?? 0))),
    request_succeeded: succeeded,
    settlement_time: new Date().toISOString(),
  });
  if (error) throw error;
}
