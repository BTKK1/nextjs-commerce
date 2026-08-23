# Merchant-Installable Platform Architecture

## Canonical definition

The product is a SaaS-like AI sales layer installed on Salla and Zid merchant product pages. The demo storefront is a temporary provider and QA harness. All platform runtime, data, dashboard, and integration boundaries are merchant-agnostic.

## Components

1. **Embed layer** — `/widget.js` reads public merchant/product attributes and injects the isolated widget host.
2. **Widget host** — `/embed/widget` resolves non-secret configuration and renders the shared React agent widget.
3. **Tenant resolver** — `loadSellerKnowledgeForProduct` maps a merchant public key to an active Supabase merchant and resolves products only inside that `merchant_id`.
4. **Catalog provider boundary** — `CatalogProvider` defines provider metadata, normalization, lookup, related products, and asynchronous catalog sync.
5. **Agent runtime** — loads active merchant configuration, sanitizes page context, enforces hard guardrails, calls the live LLM route, applies output validation/repair, and records telemetry.
6. **Persistence** — Supabase stores normalized catalog records, anonymous sessions, conversations, messages, insights, QA, integrations, and audit evidence.
7. **Merchant control center** — dashboard routes expose operational data, product-content quality, settings, roles, integrations, prompt governance, QA, and audit logs.
8. **Integration plane** — admin-gated OAuth start, validated state callback, signed webhook receiver, provider-aware sync jobs, and CSV fallback.

## Trust boundaries

- Merchant public keys and product slugs are identifiers, not authorization secrets.
- Dashboard access requires Supabase Auth plus merchant membership and role checks.
- Shopper endpoints never accept a client-supplied internal merchant UUID.
- Supabase service credentials remain in `server-only` modules.
- OAuth callbacks store only hashed one-time state; raw tokens are not stored until a production secret vault exists.
- Webhook payloads are verified before parsing and reduced to hashes/resource identifiers before persistence.
- Provider adapters cannot override core catalog-grounding and output guardrails.

## Provider lifecycle

```text
not_connected
  -> app approval and credentials configured
  -> OAuth state created (10-minute expiry)
  -> provider authorization callback validated
  -> pending_token_vault
  -> secure token exchange/ref stored externally
  -> connected
  -> catalog sync job
  -> normalized products upserted by merchant/platform/slug
  -> signed webhooks queued and processed idempotently
```

The repository currently stops before secure token exchange because no approved Salla/Zid credentials or token vault were supplied. This is an intentional safety boundary, not a simulated connection.

## Normalized product contract

Required grounding data: merchant, external/provider identity, slug, name, descriptions, price/currency, image, category, availability, inventory where supplied, and variants. Optional enrichment includes Arabic name, SKU, tags, specs, material, care/shipping notes, FAQs, objections, size guide, related products, and weak-description signals.

Raw provider payloads may be retained for reconciliation but are never trusted directly by the prompt builder; the agent receives normalized catalog context.

## Tenant isolation

- Tables carry `merchant_id` and enable RLS.
- Public runtime lookup begins with `merchants.public_key`, then applies `merchant_id` to product/config/integration queries.
- Conversation continuation checks conversation, merchant, product, and anonymous visitor together.
- Dashboard reads and writes include explicit merchant filters in addition to RLS.
- Repeated-question and insight aggregation includes merchant identity to prevent same-slug cross-tenant collisions.

## Operational failure paths

- Missing merchant/product: return a non-claiming catalog fallback and do not invoke the model.
- Missing provider credentials: OAuth/sync routes return readiness errors and make no provider call.
- Invalid webhook signature: reject before JSON parsing or persistence.
- Provider outage: sync job becomes failed with a bounded error; existing normalized catalog remains available.
- LLM failure/rate limit: route through configured live fallbacks, then return a safe model-error fallback.
- Missing catalog field or unsafe request: apply code-level fallback/refusal and record reason/insight.
- Salla/Zid approval delay: use the validated CSV import path.

## Production readiness gates

Production requires `NEXT_PUBLIC_DEMO_MODE=false`, real Auth membership, HTTPS, allowed widget origins, secret rotation, Supabase migration/RLS verification, live bilingual QA, build/E2E success, monitoring, and provider-specific sandbox contract evidence.

