import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

for (const filename of [".env", ".env.local"]) {
  try {
    const text = await readFile(filename, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !secret || !publishable) throw new Error("Supabase verification credentials are missing.");

const merchantId = "83da73d3-32d4-4f3f-a2db-4bd2ea9f4781";
const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const temporaryMerchantId = randomUUID();
const temporaryProductId = randomUUID();
const temporaryUserIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createTemporaryUser(label) {
  const email = `rls-${label}-${Date.now()}-${randomBytes(4).toString("hex")}@example.invalid`;
  const password = `${randomBytes(20).toString("base64url")}Aa1!`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error || new Error(`Temporary ${label} user was not created.`);
  temporaryUserIds.push(created.data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { id: created.data.user.id, client };
}

async function setRole(userId, role) {
  const result = await service.from("merchant_users").upsert({
    id: randomUUID(),
    merchant_id: merchantId,
    user_id: userId,
    role,
  }, { onConflict: "merchant_id,user_id" });
  if (result.error) throw result.error;
}

async function visibleCount(client, table, targetMerchantId = merchantId) {
  const result = await client.from(table).select("id", { count: "exact", head: true }).eq("merchant_id", targetMerchantId);
  if (result.error) throw result.error;
  return Number(result.count ?? 0);
}

async function updateVisible(client, table, match, values) {
  let query = client.from(table).update(values);
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value);
  const result = await query.select("id");
  return { error: result.error, count: result.data?.length ?? 0 };
}

try {
  const [pilotProduct, dashboardSettings, activeConfig, integration] = await Promise.all([
    service.from("products").select("id,name").eq("merchant_id", merchantId).limit(1).single(),
    service.from("dashboard_settings").select("id,refresh_interval").eq("merchant_id", merchantId).single(),
    service.from("agent_configs").select("id,temperature").eq("merchant_id", merchantId).eq("status", "active").limit(1).single(),
    service.from("platform_integrations").select("id,status").eq("merchant_id", merchantId).limit(1).single(),
  ]);
  for (const [label, result] of Object.entries({ pilotProduct, dashboardSettings, activeConfig, integration })) {
    if (result.error || !result.data) throw result.error || new Error(`${label} seed evidence is missing.`);
  }

  const tempMerchant = await service.from("merchants").insert({
    id: temporaryMerchantId,
    business_name: "RLS Isolation Fixture",
    display_name: "RLS Isolation Fixture",
    platform_type: "demo",
    status: "active",
    public_key: `rls_${temporaryMerchantId.replaceAll("-", "")}`,
    allowed_widget_origins: [],
  });
  if (tempMerchant.error) throw tempMerchant.error;
  const tempProduct = await service.from("products").insert({
    id: temporaryProductId,
    merchant_id: temporaryMerchantId,
    platform: "demo",
    slug: `rls-isolation-${temporaryProductId}`,
    name: "RLS Isolation Product",
    currency: "SAR",
  });
  if (tempProduct.error) throw tempProduct.error;

  const anonymous = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymousProducts = await anonymous.from("products").select("id", { count: "exact", head: true });
  assert(Boolean(anonymousProducts.error) || Number(anonymousProducts.count ?? 0) === 0, "Public shoppers could read merchant products directly.");
  const anonymousPrompts = await anonymous.from("agent_configs").select("id", { count: "exact", head: true });
  assert(Boolean(anonymousPrompts.error) || Number(anonymousPrompts.count ?? 0) === 0, "Public shoppers could read private agent configuration.");
  const anonymousRateBuckets = await anonymous.from("request_rate_limit_buckets").select("merchant_id", { count: "exact", head: true });
  assert(Boolean(anonymousRateBuckets.error) || Number(anonymousRateBuckets.count ?? 0) === 0, "Public shoppers could read request rate-limit buckets.");
  const anonymousLimiterRpc = await anonymous.rpc("consume_request_rate_limit", {
    target_merchant_id: merchantId,
    target_scope: "shopper_chat",
    target_fingerprint_hash: `rfp_v1_${"a".repeat(64)}`,
    target_limit: 20,
    target_window_seconds: 60,
    request_time: new Date().toISOString(),
  });
  assert(Boolean(anonymousLimiterRpc.error), "Public shoppers could call the server-only rate-limit RPC.");

  const outsider = await createTemporaryUser("outsider");
  assert(await visibleCount(outsider.client, "products") === 0, "An authenticated user without membership could read pilot products.");
  assert(await visibleCount(outsider.client, "products", temporaryMerchantId) === 0, "An authenticated user without membership could read another merchant.");
  const outsiderRateBuckets = await outsider.client.from("request_rate_limit_buckets").select("merchant_id", { count: "exact", head: true });
  assert(Boolean(outsiderRateBuckets.error) || Number(outsiderRateBuckets.count ?? 0) === 0, "An authenticated outsider could read request rate-limit buckets.");

  const member = await createTemporaryUser("member");
  await setRole(member.id, "viewer");
  assert(await visibleCount(member.client, "products") >= 1, "Viewer could not read merchant products.");
  assert(await visibleCount(member.client, "conversations") >= 1, "Viewer could not read merchant conversations.");
  assert(await visibleCount(member.client, "agent_configs") === 0, "Viewer could read private agent configuration.");
  assert(await visibleCount(member.client, "audit_logs") === 0, "Viewer could read privileged audit evidence.");
  assert(await visibleCount(member.client, "products", temporaryMerchantId) === 0, "Viewer could read another merchant's products.");
  assert((await updateVisible(member.client, "products", { id: pilotProduct.data.id }, { name: pilotProduct.data.name })).count === 0, "Viewer could mutate products.");
  assert((await updateVisible(member.client, "dashboard_settings", { id: dashboardSettings.data.id }, { refresh_interval: dashboardSettings.data.refresh_interval })).count === 0, "Viewer could mutate dashboard settings.");

  await setRole(member.id, "admin");
  assert(await visibleCount(member.client, "agent_configs") === 0, "Admin could read advanced prompt configuration.");
  assert(await visibleCount(member.client, "audit_logs") >= 1, "Admin could not read merchant audit evidence.");
  assert((await updateVisible(member.client, "products", { id: pilotProduct.data.id }, { name: pilotProduct.data.name })).count === 1, "Admin could not manage products.");
  assert((await updateVisible(member.client, "dashboard_settings", { id: dashboardSettings.data.id }, { refresh_interval: dashboardSettings.data.refresh_interval })).count === 1, "Admin could not manage dashboard settings.");
  assert((await updateVisible(member.client, "platform_integrations", { id: integration.data.id }, { status: integration.data.status })).count === 1, "Admin could not manage integrations.");
  assert((await updateVisible(member.client, "agent_configs", { id: activeConfig.data.id }, { temperature: activeConfig.data.temperature })).count === 0, "Admin could mutate advanced agent configuration.");

  await setRole(member.id, "advanced_admin");
  assert(await visibleCount(member.client, "agent_configs") === 1, "Advanced admin could not read agent configuration.");
  assert((await updateVisible(member.client, "agent_configs", { id: activeConfig.data.id }, { temperature: activeConfig.data.temperature })).count === 1, "Advanced admin could not manage agent configuration.");
  assert((await updateVisible(member.client, "products", { id: pilotProduct.data.id }, { name: pilotProduct.data.name })).count === 1, "Advanced admin could not manage ordinary product data.");
  assert((await updateVisible(member.client, "dashboard_settings", { id: dashboardSettings.data.id }, { refresh_interval: dashboardSettings.data.refresh_interval })).count === 1, "Advanced admin could not manage ordinary merchant settings.");
  assert((await updateVisible(member.client, "platform_integrations", { id: integration.data.id }, { status: integration.data.status })).count === 0, "Advanced admin could mutate integrations.");

  await setRole(member.id, "owner");
  assert(await visibleCount(member.client, "agent_configs") === 1, "Owner could not read agent configuration.");
  assert(await visibleCount(member.client, "audit_logs") >= 1, "Owner could not read audit evidence.");
  assert((await updateVisible(member.client, "products", { id: pilotProduct.data.id }, { name: pilotProduct.data.name })).count === 1, "Owner could not manage products.");
  assert((await updateVisible(member.client, "dashboard_settings", { id: dashboardSettings.data.id }, { refresh_interval: dashboardSettings.data.refresh_interval })).count === 1, "Owner could not manage settings.");
  assert((await updateVisible(member.client, "agent_configs", { id: activeConfig.data.id }, { temperature: activeConfig.data.temperature })).count === 1, "Owner could not manage agent configuration.");
  assert((await updateVisible(member.client, "platform_integrations", { id: integration.data.id }, { status: integration.data.status })).count === 1, "Owner could not manage integrations.");

  const directAuditWrite = await member.client.from("audit_logs").insert({
    merchant_id: merchantId,
    actor_type: "user",
    action: "unauthorized_direct_audit_write",
  });
  assert(Boolean(directAuditWrite.error), "Authenticated users could directly forge immutable audit rows.");
  const membershipWrite = await member.client.from("merchant_users").update({ role: "owner" }).eq("user_id", outsider.id).select("id");
  assert(Boolean(membershipWrite.error) || (membershipWrite.data?.length ?? 0) === 0, "A dashboard user could directly alter merchant membership.");
  const memberRateBucketWrite = await member.client.from("request_rate_limit_buckets").insert({
    merchant_id: merchantId,
    bucket_scope: "shopper_chat",
    fingerprint_hash: `rfp_v1_${"b".repeat(64)}`,
    window_started_at: new Date().toISOString(),
    request_count: 1,
  });
  assert(Boolean(memberRateBucketWrite.error), "An authenticated dashboard user could forge rate-limit buckets.");

  console.log("Supabase RLS verification passed: public isolation, no-access isolation, cross-merchant isolation, viewer read-only behavior, admin product/settings/integration boundaries, advanced-agent governance, owner access, immutable audit/membership controls, and service-only abuse-control buckets/RPC.");
} finally {
  await service.from("merchants").delete().eq("id", temporaryMerchantId);
  for (const userId of temporaryUserIds) await service.auth.admin.deleteUser(userId);
}
