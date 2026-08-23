export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MerchantRole = "founder" | "owner" | "admin" | "advanced_admin" | "viewer";
export type PromptStatus = "draft" | "tested" | "published" | "archived" | "rollback";

export interface AgentConfigRow {
  id: string;
  merchant_id: string;
  name: string;
  status: "draft" | "active" | "archived";
  model_provider: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  response_language_policy: string;
  tone_preset: string;
  system_prompt: string;
  developer_prompt: string | null;
  product_context_policy: Json;
  fallback_policy: Json;
  safety_policy: Json;
  objection_policy: Json;
  advanced_settings: Json;
  active_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersionRow {
  id: string;
  agent_config_id: string;
  merchant_id: string;
  version_number: number;
  title: string | null;
  system_prompt: string;
  developer_prompt: string | null;
  change_note: string | null;
  test_result: Json;
  status: PromptStatus;
  created_by: string | null;
  published_by: string | null;
  created_at: string;
  published_at: string | null;
}

export interface GuardrailRow {
  id: string;
  merchant_id: string;
  agent_config_id: string | null;
  allowed_topics: Json;
  blocked_topics: Json;
  blocked_claims: Json;
  fallback_response_ar: string | null;
  fallback_response_en: string | null;
  confidence_threshold: number;
  on_violation: "refuse" | "fallback" | "escalate";
  created_at: string;
  updated_at: string;
}

export interface MerchantRow {
  id: string; public_key: string; business_name: string; display_name: string | null; email: string | null; phone: string | null;
  platform_type: "demo" | "salla" | "zid" | "multi"; status: string; allowed_widget_origins: Json; created_at: string; updated_at: string;
}

export interface ProductRow {
  id: string; merchant_id: string; external_id: string | null; platform: "demo" | "salla" | "zid"; slug: string; name: string;
  arabic_name: string | null; description: string | null; short_description: string | null; price: number | null; compare_at_price: number | null;
  currency: string; image_url: string | null; category: string | null; availability: string | null; inventory_count: number | null;
  variants: Json; attributes: Json; faqs: Json; sales_guidance: Json; raw_platform_payload: Json; created_at: string; updated_at: string;
}

export interface PlatformIntegrationRow {
  id: string; merchant_id: string; provider: "demo" | "salla" | "zid"; status: "connected" | "not_connected" | "pending" | "disabled" | "error";
  encrypted_credential_ref: string | null; scopes: Json; connected_at: string | null; external_store_id: string | null; last_synced_at: string | null;
  provider_config: Json; metadata_json: Json; created_at: string; updated_at: string;
}

export interface SyncJobRow {
  id: string; merchant_id: string; integration_id: string | null; provider: "demo" | "salla" | "zid"; job_type: string; resource: string | null;
  status: "pending" | "running" | "success" | "failed"; cursor: string | null; records_processed: number; started_at: string | null;
  finished_at: string | null; error: string | null; metadata_json: Json; created_at: string; updated_at: string;
}

export interface WebhookEventRow {
  id: string; merchant_id: string; integration_id: string | null; provider: "demo" | "salla" | "zid"; external_event_id: string | null;
  event_type: string; payload: Json; headers_json: Json; status: "received" | "processed" | "failed" | "ignored";
  received_at: string; processed_at: string | null; error: string | null;
}

export interface OAuthStateRow {
  id: string; merchant_id: string; integration_id: string | null; provider: "salla" | "zid"; state_hash: string; redirect_path: string;
  expires_at: string; consumed_at: string | null; created_by: string | null; created_at: string;
}

export interface PlatformAgentConfigRow {
  singleton_key: "global"; system_prompt: string; developer_prompt: string; model_provider: "openrouter" | "deepseek-direct";
  model_name: string; updated_at: string; updated_by: string | null;
}

export interface RequestRateLimitBucketRow {
  merchant_id: string; bucket_scope: string; fingerprint_hash: string; window_started_at: string; request_count: number; updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      merchants: { Row: MerchantRow; Insert: Partial<MerchantRow> & Pick<MerchantRow, "business_name">; Update: Partial<MerchantRow> };
      products: { Row: ProductRow; Insert: Partial<ProductRow> & Pick<ProductRow, "merchant_id" | "platform" | "slug" | "name">; Update: Partial<ProductRow> };
      agent_configs: { Row: AgentConfigRow; Insert: Partial<AgentConfigRow> & Pick<AgentConfigRow, "merchant_id" | "name" | "model_name" | "system_prompt">; Update: Partial<AgentConfigRow> };
      prompt_versions: { Row: PromptVersionRow; Insert: Partial<PromptVersionRow> & Pick<PromptVersionRow, "agent_config_id" | "merchant_id" | "version_number" | "system_prompt">; Update: Partial<PromptVersionRow> };
      guardrails: { Row: GuardrailRow; Insert: Partial<GuardrailRow> & Pick<GuardrailRow, "merchant_id">; Update: Partial<GuardrailRow> };
      platform_integrations: { Row: PlatformIntegrationRow; Insert: Partial<PlatformIntegrationRow> & Pick<PlatformIntegrationRow, "merchant_id" | "provider" | "status">; Update: Partial<PlatformIntegrationRow> };
      sync_jobs: { Row: SyncJobRow; Insert: Partial<SyncJobRow> & Pick<SyncJobRow, "merchant_id" | "provider" | "status">; Update: Partial<SyncJobRow> };
      webhook_events: { Row: WebhookEventRow; Insert: Partial<WebhookEventRow> & Pick<WebhookEventRow, "merchant_id" | "provider" | "event_type">; Update: Partial<WebhookEventRow> };
      oauth_states: { Row: OAuthStateRow; Insert: Partial<OAuthStateRow> & Pick<OAuthStateRow, "merchant_id" | "provider" | "state_hash" | "expires_at">; Update: Partial<OAuthStateRow> };
      platform_agent_config: { Row: PlatformAgentConfigRow; Insert: Partial<PlatformAgentConfigRow> & Pick<PlatformAgentConfigRow, "singleton_key" | "system_prompt" | "model_provider" | "model_name">; Update: Partial<PlatformAgentConfigRow> };
      request_rate_limit_buckets: { Row: RequestRateLimitBucketRow; Insert: RequestRateLimitBucketRow; Update: Partial<RequestRateLimitBucketRow> };
    };
    Functions: {
      consume_request_rate_limit: {
        Args: { target_merchant_id: string; target_scope: string; target_fingerprint_hash: string; target_limit: number; target_window_seconds: number; request_time: string };
        Returns: Array<{ allowed: boolean; retry_after_seconds: number; current_count: number }>;
      };
    };
  };
}
