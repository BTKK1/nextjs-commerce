# AI Sales Agent Platform for Salla and Zid

The demo store is only the current fake pilot merchant. The real project is the Supabase-backed AI Sales Agent platform for Salla/Zid merchants, with a product-page widget, live LLM agent, merchant dashboard, advanced prompt/guardrail settings, conversation logging, insights, QA loop, and future Salla/Zid adapters.

Maison Vert and the inherited Bagisto storefront are a development harness: they supply eight product pages, images, variants, buyer scenarios, and dashboard telemetry before real platform credentials are approved. They are not the product, the platform backend, or the intended merchant admin.

## Product boundaries

The platform provides:

- a shared server-side sales-agent runtime;
- a merchant-installable product-page widget;
- merchant- and product-scoped catalog grounding;
- a normalized catalog provider contract;
- Demo Catalog, Salla, and Zid adapters;
- Supabase persistence, authentication, roles, RLS, and audit logs;
- conversations, transcript evidence, repeated questions, objections, weak-content signals, fallbacks, and quality metrics;
- advanced prompt drafts, QA, publishing, rollback, version comparison, and immutable code guardrails;
- OAuth, webhook, sync-job, and CSV fallback architecture for platform onboarding.

It is not an ecommerce store, checkout product, Bagisto admin, Maison Vert project, generic chatbot, or payment-data collector.

## Runtime flow

```text
Shopper product page
  -> /widget.js embed loader
  -> isolated /embed/widget frame
  -> merchant public key + product reference
  -> server resolves active merchant and normalized product in Supabase
  -> server loads the merchant's active agent version and guardrails
  -> grounded LLM route with code-enforced safety
  -> conversation/messages/telemetry/insights persisted by merchant_id
  -> merchant dashboard shows evidence and quality signals
```

System prompts, provider secrets, Supabase service credentials, raw OAuth tokens, and internal reasoning are never returned to the shopper widget.

## Provider architecture

| Provider | Current state | Purpose |
|---|---|---|
| Demo Catalog | Connected for the pilot | Development, visual QA, and fallback catalog only |
| Salla | Adapter/OAuth/webhook/sync boundaries ready; not connected | Future production merchant catalog |
| Zid | Adapter/OAuth/webhook/sync boundaries ready; not connected | Future production merchant catalog |
| CSV/product export | Import command ready | Approval-delay fallback into the normalized products table |

Salla or Zid is not marked connected until app approval, credentials, scopes, secure token storage, and provider-specific contract tests are complete. The callback deliberately stops at `pending_token_vault`; it does not store raw tokens in Supabase.

## Main routes

Shopper/platform:

- `GET /widget.js` — external embed loader.
- `GET /embed/widget` — isolated widget host.
- `GET /api/widget/config` — public, non-secret merchant/product configuration.
- `GET|POST /api/agent/chat` — transcript hydration and grounded sales conversations.
- `POST /api/events` — anonymous widget/product telemetry.
- `GET /api/agent/health` — model and catalog-provider health metadata.

Integration readiness:

- `GET /api/integrations/[provider]/oauth/start`
- `GET /api/integrations/[provider]/oauth/callback`
- `POST /api/integrations/[provider]/webhooks`
- `POST /api/dashboard/integrations/[provider]/sync`

Merchant dashboard:

- `/dashboard`
- `/dashboard/conversations` and `/dashboard/conversations/[id]`
- `/dashboard/insights`
- `/dashboard/products`
- `/dashboard/integrations`
- `/dashboard/settings`
- `/dashboard/agent`, `/advanced`, `/versions`, `/qa`, and `/playground`
- `/dashboard/audit-log`

## Supabase model and access

Versioned migrations create merchant-scoped UUID tables for merchants, merchant users, products, visitors, conversations, messages, insights and insight sources, settings, agent configs, prompt versions, guardrails, integrations, sync jobs, webhook events, OAuth state, audit logs, QA runs/cases, and analytics events.

Roles:

- `owner`: full merchant administration and advanced agent governance;
- `admin`: products, integrations, settings, conversation review, and audit visibility;
- `advanced_admin`: advanced prompt/QA governance without integration ownership;
- `viewer`: merchant analytics, conversations, products, and integration status; no mutations or private prompts.

The shopper runtime uses a public merchant key only as an identifier. Server-side code resolves it to `merchant_id`; all reads and writes remain explicitly merchant-scoped. The service key is server-only.

## Local setup

Requirements: Node.js 22 and pnpm 11.7.0.

```bash
pnpm install --frozen-lockfile
pnpm run generate:demo-assets
pnpm run seed:demo
pnpm run dev
```

Use the Preview Server Manager described in `AGENTS.md` before starting a development or production preview. Do not launch a second server for the same project.

## Supabase setup

Copy `.env.example` to ignored `.env.local` and provide the Supabase URL, publishable key, server-only service key, direct migration URL, and transaction pool URL. Never commit real credentials.

```bash
pnpm run supabase:migrate
pnpm run supabase:seed
pnpm run platform:verify
pnpm run supabase:verify
pnpm run db:types
```

Create the real client in Supabase Auth, then set `SEED_OWNER_USER_ID` to that Auth UUID and rerun the idempotent seed to create the owner membership. Do not invent an owner identity.

For production:

```text
DATA_BACKEND=supabase
NEXT_PUBLIC_DEMO_MODE=false
SUPABASE_AGENT_ENABLED=true
```

Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin. Configure a unique `WIDGET_SIGNING_SECRET`, `INTEGRATION_STATE_SECRET`, and server-only `AGENT_RATE_LIMIT_SECRET` of at least 32 random characters. Add merchant widget-origin allowlists before public rollout. Vercel's overwritten client forwarding header is HMAC-pseudonymized for atomic shopper and Founder abuse limits; raw client IPs are never stored. Self-hosted deployments may enable `TRUST_PROXY_IP_HEADERS=true` only behind a proxy that strips and rewrites inbound forwarding headers.

## Embedding on a product page

```html
<script
  async
  src="https://agent.example/widget.js"
  data-merchant-key="merchant_public_key"
  data-product-ref="merchant-product-slug"
  data-locale="ar"
></script>
```

The merchant key is public and identifies the tenant; it is not a Supabase key. Product references resolve only within that merchant.

## CSV approval-delay fallback

Required columns: `name`, `description`, `price`, `images`, `category`, `availability`, and `variants`. Recommended optional columns: `slug`, `external_id`, `sku`, `arabic_name`, `short_description`, `compare_at_price`, `currency`, `inventory`, `tags`, `faqs`, and `shipping_notes`. JSON-valued cells such as images, variants, tags, and FAQs must contain valid JSON.

```bash
pnpm catalog:import:csv --file=products.csv --merchant-id=<merchant-uuid> --platform=demo
```

## Safety invariants

Dashboard prompt edits cannot disable code-level rules against invented discounts, delivery dates, warranties, certifications, stock, policies, or unsupported catalog claims. The runtime also blocks prompt disclosure, credential requests, card-data collection, and page-context injection. Missing catalog data must produce a transparent merchant/product-page fallback.

Arabic answers use a neutral Saudi tone. Responses match the shopper language and remain commercially helpful without pressure.

## Verification and handoff

```bash
pnpm run secrets:check
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm exec vitest run tests/integration
pnpm run test:e2e
pnpm run test:agent:quality
pnpm run build
pnpm run handoff:check
```

See [PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md), [PLATFORM_COMPLETION_AUDIT.md](./PLATFORM_COMPLETION_AUDIT.md), [DASHBOARD_COMPLETION_AUDIT.md](./DASHBOARD_COMPLETION_AUDIT.md), and [HANDOFF_REPORT.md](./HANDOFF_REPORT.md).

Canonical identity and security references: [PRODUCT_SOLUTION_GOALS.md](./PRODUCT_SOLUTION_GOALS.md), [SECURITY.md](./SECURITY.md), and—while the current external backend remains unavailable—[SUPABASE_SETUP_REQUIRED.md](./SUPABASE_SETUP_REQUIRED.md).

## External work still required

- obtain Salla and Zid app/API approval, OAuth credentials, webhook specifications, and production scopes;
- connect a production secret vault and implement provider-specific token refresh/exchange;
- finish payload normalization against approved API fixtures;
- run sandbox and production contract tests before enabling either provider;
- create and map the real merchant owner account;
- rotate any server credentials previously shared outside the deployment secret manager.
