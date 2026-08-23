import "server-only";

import { createServiceClient } from "@/utils/supabase/server";

export interface DurableRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function consumeDurableRateLimit(input: {
  merchantId: string;
  scope: string;
  fingerprint: string;
  limit: number;
  windowSeconds: number;
}): Promise<DurableRateLimitResult> {
  const { data, error } = await createServiceClient().rpc("consume_request_rate_limit", {
    target_merchant_id: input.merchantId,
    target_scope: input.scope,
    target_fingerprint_hash: input.fingerprint,
    target_limit: input.limit,
    target_window_seconds: input.windowSeconds,
    request_time: new Date().toISOString(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || typeof (row as Record<string, unknown>).allowed !== "boolean") {
    throw new Error("Rate-limit service returned an invalid response.");
  }
  const result = row as Record<string, unknown>;
  return {
    allowed: result.allowed as boolean,
    retryAfterSeconds: Math.max(0, Number(result.retry_after_seconds ?? 0) || 0),
  };
}
