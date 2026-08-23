# Implementation Log

## 2026-08-13 - Platform Route Contract Regression Pass

- Added behavioral route tests for single-use OAuth state consumption, signed-body-only webhook tenant routing, duplicate webhook acknowledgement, sanitized sync failures, and Supabase Founder global configuration reads/writes.
- Confirmed the partial-index `ON CONFLICT` target is valid PostgreSQL syntax and that all new `security definer` RPCs are revoked from public, anonymous, and authenticated roles and granted only to `service_role`.
- Stabilized widget E2E assertions around the intentional greeting/response typing animation without changing product behavior.
- Verification passes: lint, typecheck, 83/83 unit tests, 20/20 integration tests, 42 local E2E cases with only two live-Supabase governance cases skipped, 25/25 static-page build generation, and secret scan across 655 files.
- Final browser evidence used the registered production preview at `http://127.0.0.1:3000` with `duplicateCount=0`; the landing hash remains unchanged.
- Client handoff remains blocked until a reachable Supabase project is migrated/seeded and production Auth, RLS, persistence, governance, and Vercel deployment checks pass.

## 2026-08-13 - Role Matrix, RLS Proof, And Integration Audit Hardening

- Expanded the live RLS verifier from two read checks to an anonymous/no-membership/cross-merchant and viewer/admin/advanced_admin/owner access matrix, including direct audit-forgery and membership-escalation denial.
- Revoked authenticated direct writes to immutable audit evidence, merchant membership, webhook events, and OAuth states; server-only service operations and atomic RPCs remain authoritative.
- Added atomic sanitized audit events for OAuth initiation, OAuth callback consumption, accepted webhooks, and integration sync success/failure.
- Separated integration ownership from advanced prompt governance: owner/admin can connect or sync providers, advanced_admin cannot, and viewers can still read honest integration status without connection controls.
- Enforced same-origin checks on Founder login, logout, and playground POST/PATCH; moved the inherited Bagisto revalidation secret out of the URL query string into a request header and return 401 on failure.
- Verification: lint and typecheck pass; 86/86 unit tests, 22/22 integration tests, and 12/12 focused dashboard/embed browser tests pass. The stronger live RLS run still stops at the known Supabase DNS blocker before any fixture is created.

## 2026-08-13 - Supabase Runtime Fail-Closed And Atomic Governance Hardening

- Supabase-selected mode no longer falls back to the local catalog, demo owner identity, local dashboard database, default merchant prompt, or JSON chat runtime when configuration/querying fails.
- `/api/agent/health` now reports backend and persistence truthfully and returns HTTP 503 with logging/insights disabled when Supabase is selected but not operational.
- The handoff gate now requires `SUPABASE_AGENT_ENABLED=true`.
- The direct Supabase runtime owns durable visitor lookup, conversation ownership/history, shared rate limiting, message/insight/source/analytics writes, and dashboard analytics fields.
- Removed the production dependency on local-to-Supabase snapshot synchronization and prevented standalone event tracking from mutating local JSON in Supabase mode.
- Prompt publish/rollback RPCs are service-role-only `security definer` functions and atomically write governance state plus audit evidence.
- Added `tests/unit/supabase-fail-closed.test.ts`; the subsequent full suite passes 80/80 unit tests and 14/14 core integration tests.
- Browser verification against the reused registered preview `http://127.0.0.1:3000`: product 16/16, agent/embed 18/18, dashboard 8/8; two live-Supabase governance cases remain skipped.
- Lint, typecheck, secret scan across 654 files, 25-page production build, and `graphify update .` pass.
- Landing page remains byte-identical to `nabih-landing-3.html` at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- Client handoff remains blocked because the live Supabase project/credentials are unavailable and production cannot yet prove Auth/RLS/runtime/governance.

## 2026-08-13 - Destructive Prompt Governance Confirmation

- Added an accessible reusable confirmation submit control for prompt governance actions.
- Publish now warns that shopper responses change immediately; rollback identifies audit logging; archive requires explicit confirmation.
- Updated the live-Supabase governance E2E flow to accept and assert confirmation dialogs.
- Added a unit guard proving publish, rollback, and archive all remain confirmation-protected.
- Focused lint, typecheck, and eight governance/versioning tests pass.
- Rechecked external access: the stored Supabase project hostname still returns DNS `NXDOMAIN`, Supabase CLI has no access token, Vercel still has no Supabase variables, and production still reports the older demo catalog runtime.

## 2026-08-13 - Integration Boundary And Founder Governance Hardening

- OAuth initiation is now a same-origin POST; GET returns 405 and cannot mutate integration state.
- OAuth integration preparation/state creation and callback consumption/pending-vault transitions are atomic and single-use.
- Webhook tenant routing derives external store identity only from the signed body, never an unsigned merchant header; enqueueing is atomic and idempotent per integration/event.
- Catalog sync requires same-origin requests, store/credential references, successful job creation, and returns sanitized public failures.
- The new OAuth/webhook RPCs are `security definer`, revoked from public/anon/authenticated, and granted only to `service_role`.
- Supabase-selected Founder global prompt/model governance is authoritative in a service-only singleton table, fails closed when unavailable, and updates atomically with its audit record. Blob/file governance remains local-mode only.
- Global configuration changes require confirmation and validate developer-guidance length server-side.
- Lint/typecheck, 83/83 unit tests, 14/14 core integration tests, 4/4 focused embed E2E, and the 654-file secret scan pass.

## 2026-07-07 - Agent Readiness Loop Started

- Goal attempted: make the product-page agent ready for client handoff with Supabase backend wiring, Ting-style orchestration, CI/E2E backend coverage, and English/Arabic response evaluation.
- Files changed so far:
  - `package.json`
  - `pnpm-lock.yaml`
  - `pnpm-workspace.yaml`
  - `PROJECT_GOALS.md`
  - `IMPLEMENTATION_LOG.md`
- Tests run:
  - Prior baseline after chat UI fix: lint, typecheck, unit/integration tests, E2E, build all passed.
  - Dependency install: `pnpm install --reporter append-only` passed after approving Prisma engine builds.
- Result:
  - Supabase packages installed.
  - Prisma dev dependency installed and reproducible under workspace build policy.
  - Control docs created for the current cto-loop readiness pass.
- Next goal:
  - Add Supabase env/config helpers, Prisma schema, Supabase persistence adapter, and agent orchestration/eval coverage.

## 2026-07-07 - Supabase, Orchestration, And Agent Eval Completed

- Goal attempted: wire the provided Supabase project, align the product agent with Ting-style deterministic-first orchestration, and prove readiness with backend checks, evals, build, and E2E.
- Files changed:
  - `.env.example`
  - `.github/workflows/ci.yml`
  - `README.md`
  - `package.json`
  - `playwright.config.ts`
  - `pnpm-lock.yaml`
  - `pnpm-workspace.yaml`
  - `prisma.config.ts`
  - `prisma/schema.prisma`
  - `supabase/schema.sql`
  - `src/lib/agent/evaluator.ts`
  - `src/lib/agent/chat-service.ts`
  - `src/lib/agent/llm-client.ts`
  - `src/lib/agent/legacy-local-llm.ts`
  - `src/lib/agent/prompt-builder.ts`
  - `src/lib/ai/model-config.ts`
  - `src/lib/storage/supabase-store.ts`
  - `src/lib/types.ts`
  - `src/app/api/events/route.ts`
  - `src/proxy.ts`
  - `src/utils/supabase/client.ts`
  - `src/utils/supabase/server.ts`
  - `src/utils/supabase/middleware.ts`
  - `tests/integration/agent-eval.test.ts`
- Tests and checks run:
  - `pnpm install --reporter append-only`
  - `pnpm run supabase:push`
  - Supabase smoke script: upserted demo merchant/products, inserted/read one `agent_evaluations` row, read back 6 products and 1 evaluation row.
  - `pnpm run backend:check`
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test:unit`
  - `pnpm run test:agent`
  - `pnpm run build`
  - `pnpm run test:e2e`
  - Full local CI: `pnpm run ci`
- Result:
  - Supabase schema applied successfully.
  - Supabase server/browser helpers and middleware refresh helper added.
  - Agent can sync conversation snapshots, events, insights, and agent action telemetry to Supabase when `SUPABASE_AGENT_ENABLED=true`.
  - Agent live mode now uses the Ting route chain: OpenRouter Gemini Flash Lite, OpenRouter Qwen fallback, DeepSeek direct fallback.
  - Superseded note: this early local fallback was later removed from the handoff/runtime agent path; current handoff validation is live OpenRouter only.
  - Agent eval suite covers English product knowledge, Arabic product knowledge, missing warranty fallback, and unsafe Arabic refusal.
  - Full local CI passed.
- Next goal:
  - Superseded by the later live-only client handoff requirement.

## 2026-07-07 - Product Page Agent Context And Branding Fixed

- Goal attempted: focus the product-page AI agent so it appears on each Maison Vert product page, uses store-specific branding, knows the current page/product context, and works in English and Arabic.
- Files changed:
  - `eslint.config.mjs`
  - `src/app/api/agent/chat/route.ts`
  - `src/components/saleh-demo/AgentWidget.tsx`
  - `src/components/saleh-demo/DemoProductPage.tsx`
  - `src/lib/agent/evaluator.ts`
  - `src/lib/agent/guardrails.ts`
  - `src/lib/agent/language.ts`
  - `src/lib/agent/llm-client.ts`
  - `src/lib/agent/legacy-local-llm.ts`
  - `src/lib/agent/prompt-builder.ts`
  - `src/lib/insights/extractor.ts`
  - `src/lib/storage/supabase-store.ts`
  - `src/lib/types.ts`
  - `tests/e2e/demo.spec.ts`
  - `tests/integration/agent-api.test.ts`
  - `tests/integration/agent-eval.test.ts`
  - `tests/unit/guardrails.test.ts`
  - `tests/unit/insights-and-aggregations.test.ts`
  - `tests/unit/prompt-and-live.test.ts`
- Tests and checks run:
  - Playwright browser check against `http://127.0.0.1:3000/product/atelier-wool-coat`: widget visible, header is `Maison Vert Assistant`, subtitle is product-specific, payload includes `url`, `path`, `title`, and `productName`.
  - Playwright mobile browser check: English product answer returned grounded coat warmth data.
  - Playwright mobile browser check: Arabic size question returned valid Arabic with product variants and size guidance.
  - `pnpm exec playwright install chromium`
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test:unit`
  - `pnpm run test:agent`
  - `pnpm run backend:check`
  - `pnpm run build`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm run test:e2e`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm run ci`
- Result:
  - Agent no longer uses the `Tingy` placeholder name.
  - Widget opening line is bilingual and store-specific.
  - Chat requests and live-mode prompts now include current page context.
  - Supabase agent action telemetry can store sanitized page context metadata server-side.
  - Arabic local canned responses, guardrails, insight classification, and response evaluation no longer contain mojibake text.
  - Full local CI passed, including 12 Playwright E2E tests across desktop and mobile.
- Next goal:
  - Optional live-provider smoke test when deployment has real OpenRouter or DeepSeek credentials configured.

## 2026-07-07 - Store Locale Toggle And Agent Language Behavior

- Goal attempted: add Ting-style EN/AR storefront switching, localize the product-page agent greeting by page language, and keep agent replies tied to the shopper's message language.
- Files changed:
  - `src/components/saleh-demo/LocalizedStoreShell.tsx`
  - `src/components/saleh-demo/StoreLocaleProvider.tsx`
  - `src/components/saleh-demo/store-i18n.ts`
  - `src/components/saleh-demo/DemoHomePage.tsx`
  - `src/components/saleh-demo/DemoProductPage.tsx`
  - `src/components/saleh-demo/AgentWidget.tsx`
  - `src/app/(public)/layout.tsx`
  - `src/app/(public)/page.tsx`
  - `src/app/layout.tsx`
  - `src/app/api/agent/chat/route.ts`
  - `src/app/api/events/route.ts`
  - `src/lib/agent/chat-service.ts`
  - `src/lib/agent/guardrails.ts`
  - `src/lib/agent/language.ts`
  - `src/lib/agent/prompt-builder.ts`
  - `src/lib/analytics/events.ts`
  - `src/lib/storage/supabase-store.ts`
  - `src/lib/types.ts`
  - `supabase/schema.sql`
  - `tests/integration/agent-api.test.ts`
  - `tests/e2e/demo.spec.ts`
- Tests and checks run:
  - Reused healthy registered preview server `http://127.0.0.1:3000`; removed a stale failed `3001` registry entry created by a path-normalization issue.
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/unit/prompt-and-live.test.ts tests/integration/agent-api.test.ts`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm run test:e2e`
  - `pnpm exec prisma db execute --stdin` with `alter table if exists analytics_events add column if not exists storefront_locale text;`
- Result:
  - Navbar now has EN/AR switching persisted in localStorage and reflected on `html lang/dir`.
  - Home/product UI and product-card copy localize between English and Arabic.
  - Agent initial greeting is English on English pages and Arabic on Arabic pages.
  - Agent API still replies based on the shopper's latest message language, including English replies from an Arabic page.
  - Agent events and Supabase action snapshots now carry storefront locale metadata.
  - Supabase `analytics_events` can store `storefront_locale`.
  - Arabic fallback/guardrail strings were repaired and covered by tests.

## 2026-07-07 - Chat Bubble Expansion Behavior Fixed

- Goal attempted: make the agent panel expand from the chat bubble anchor instead of sitting above a still-visible chat icon.
- Files changed:
  - `src/components/saleh-demo/AgentWidget.tsx`
  - `IMPLEMENTATION_LOG.md`
- Tests and checks run:
  - Playwright geometry check against `http://127.0.0.1:3000/product/atelier-wool-coat`: closed state has only the 64px bubble; open state has only the panel, anchored to the same bottom-right position with no bubble underneath.
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/unit/prompt-and-live.test.ts tests/integration/agent-api.test.ts`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm run test:e2e`
- Result:
  - The closed chat icon is replaced by the open chat panel at the same bottom-right anchor.
  - The panel no longer sits above a separate visible icon.
  - Desktop and mobile E2E still pass.

## 2026-07-07 - Live LLM Mode Enabled And Product Notice Removed

- Goal attempted: answer whether the agent is using a real LLM, switch the local product agent to live provider mode, and remove the unnecessary product-page demo notice.
- Files changed:
  - `.env.local`
  - `src/components/saleh-demo/DemoProductPage.tsx`
  - `tests/e2e/demo.spec.ts`
  - `IMPLEMENTATION_LOG.md`
- Tests and checks run:
  - Restarted the local Next server on `127.0.0.1:3000` so env changes are loaded.
  - Live API check: `/api/agent/chat` returned `mode: live`, `provider: openrouter`, `model: google/gemini-2.5-flash-lite`, and `providerRoute: openrouter(ok)`.
  - Browser check: `Demo store only` and `local browser interactions` are absent from `/product/atelier-wool-coat`.
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/unit/prompt-and-live.test.ts tests/integration/agent-api.test.ts`
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm run test:e2e`
- Result:
  - Local agent validation now uses the real LLM path instead of the previous local response path.
  - The product-page demo notice was removed.
  - Desktop and mobile E2E passed against the running local server.

## 2026-07-07 - Ting Sales Agent Model Route Alignment Verified

- Goal attempted: ensure the product-page store agent uses the same model orchestration as the Ting website/CRM Sales Helper Agent.
- Source inspected:
  - `E:\Ting-CRM\lib\poc\ai\provider.ts`, role `sales_agent_chat`
  - `E:\Ting-CRM\docs\sales-crm\PLANNER_MODEL_EVIDENCE_2026-07-03.md`
  - Ting live `poc_provider_routes` table for `sales_agent_chat`
- Finding:
  - Ting has no live DB override for `sales_agent_chat`, so code defaults apply.
  - Exact Ting route is OpenRouter `google/gemini-2.5-flash-lite`, then OpenRouter `qwen/qwen3-235b-a22b-2507`, then DeepSeek direct `deepseek-chat`.
- Files changed:
  - `.env.example`
  - `.env.local`
  - `README.md`
  - `src/lib/ai/model-config.ts`
  - `tests/unit/prompt-and-live.test.ts`
  - `IMPLEMENTATION_LOG.md`
- Tests and checks run:
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/unit/prompt-and-live.test.ts tests/integration/agent-api.test.ts`
  - Restarted local Next server on `127.0.0.1:3000`.
  - Live API check: `/api/agent/chat` returned `mode: live`, `provider: openrouter`, `model: google/gemini-2.5-flash-lite`, `providerRoute: openrouter(ok)`.
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 pnpm run test:e2e`
- Result:
  - Store agent model route now uses the same env names and default order as Ting `sales_agent_chat`: `SALES_AGENT_MODEL`, `SALES_AGENT_FALLBACK_MODEL`, `SALES_AGENT_FALLBACK2_MODEL`.
  - Desktop and mobile E2E passed.

## 2026-07-07 - Client Handoff Acceptance Loop Started

- Goal attempted: move the Maison Vert showcase build toward the client handoff acceptance bar with deterministic agent-quality coverage, browser E2E coverage, dashboard validation, CI, and handoff reporting.
- Files changed:
  - `CLIENT_HANDOFF_ACCEPTANCE.md`
  - `AGENT_E2E_LOOP.md`
  - `HANDOFF_REPORT.md`
  - `AGENT_QUALITY_REPORT.md`
  - `.github/workflows/ci.yml`
  - `package.json`
  - `prisma/schema.prisma`
  - `scripts/check-secrets.mjs`
  - `scripts/handoff-check.mjs`
  - `scripts/run-agent-quality-matrix.mjs`
  - `scripts/seed-demo.mjs`
  - `src/lib/agent/evaluator.ts`
  - `src/lib/insights/extractor.ts`
  - `src/lib/storage/seed.ts`
- Tests and checks run:
  - `pnpm run secrets:check`
  - `pnpm run backend:check`
  - `pnpm run typecheck`
  - `pnpm exec vitest run tests/unit/insights-and-aggregations.test.ts tests/integration/agent-quality-matrix.test.ts`
  - `pnpm run test:agent:quality`
- Result:
  - Deterministic agent-quality matrix passes 58 cases with 10/10 average, 100% known-fact rate, 100% unknown fallback rate, 100% unsafe/out-of-scope safe handling, and 0 hard failures.
  - Gift questions now classify as `gift_concern` before broader suitability matching.
  - The evaluator recognizes legitimate next steps such as asking the merchant or starting with the usual size.
  - Prisma now models `analytics_events.storefront_locale`.
  - CI now runs the same deterministic `handoff:check` command and uploads Playwright plus agent-quality artifacts.
  - Seeded config now reports the Ting primary model instead of the older single Qwen fallback.
  - Full `pnpm run handoff:check` is the next loop gate.

## 2026-07-07 - Client Handoff Suite Passed

- Goal attempted: close the handoff readiness loop with deterministic CI coverage, live agent smoke, dashboard runtime validation, and final reports.
- Files changed:
  - `CLIENT_HANDOFF_ACCEPTANCE.md`
  - `AGENT_E2E_LOOP.md`
  - `HANDOFF_REPORT.md`
  - `AGENT_QUALITY_REPORT.md`
  - `AGENT_QUALITY_REPORT_LIVE.md`
  - `scripts/handoff-check.mjs`
  - `src/app/dashboard/*/page.tsx`
  - `src/lib/agent/llm-client.ts`
  - `tests/e2e/dashboard-insights.spec.ts`
  - `tests/e2e/support/page-watch.ts`
  - `tests/integration/agent-quality-matrix.test.ts`
  - `tests/unit/prompt-and-live.test.ts`
- Failures found and fixed:
  - Managed `pnpm run start -- -H ...` exited under Next; handoff server now uses `pnpm exec next start`.
  - Dashboard pages were prerendered and did not reflect runtime E2E conversations; dashboard routes are now dynamic.
  - Managed production server lacked `NEXTAUTH_SECRET`; handoff server env now includes auth configuration.
  - Live model returned a truncated Arabic price answer and a comparison without current-product grounding; live answers now pass through catalog-grounding repair with regression coverage.
- Tests and checks run:
  - `pnpm run handoff:check` PASS
  - `pnpm run test:agent:live` PASS
  - `pnpm run test:agent:quality` PASS
  - Focused Playwright reruns for agent, dashboard, and storefront specs PASS
- Result:
  - Deterministic handoff score: 70/70 acceptance items.
  - Deterministic agent quality: 58 cases, 10/10 average, 0 hard failures.
  - Live agent quality: 58 cases, 9.34/10 average, 0 hard failures.
  - Browser E2E: 22 tests pass across desktop and mobile.
  - Commit-candidate secret scan: 549 files pass.
  - CI workflow is configured to run the deterministic handoff suite and upload artifacts.

## 2026-07-07 - Live-Only OpenRouter Handoff Pass

- Goal attempted: remove fake/local behavior from the live agent validation path, prove the widget and API hit OpenRouter, and continue the client handoff loop until all gates pass.
- Files changed:
  - `src/lib/ai/model-config.ts`
  - `src/lib/agent/llm-client.ts`
  - `src/lib/agent/prompt-builder.ts`
  - `src/lib/agent/guardrails.ts`
  - `src/lib/agent/evaluator.ts`
  - `src/lib/privacy/redaction.ts`
  - `src/lib/storage/supabase-store.ts`
  - `src/app/api/agent/chat/route.ts`
  - `src/utils/auth.ts`
  - `scripts/run-agent-quality-matrix.mjs`
  - `scripts/handoff-check.mjs`
  - `playwright.config.ts`
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `tests/integration/agent-api.test.ts`
  - `tests/integration/agent-eval.test.ts`
  - `tests/integration/agent-quality-matrix.test.ts`
  - `.github/workflows/ci.yml`
  - `CLIENT_HANDOFF_ACCEPTANCE.md`
  - `AGENT_E2E_LOOP.md`
  - `HANDOFF_REPORT.md`
  - `AGENT_QUALITY_REPORT.md`
- Failures found and fixed:
  - Live path silently downgraded to a local canned provider if keys were missing; requested live mode now stays live and fails visibly if providers are not configured.
  - Live answers previously had a local canned-text repair path; live mode now uses only provider answers plus guardrail/fallback enforcement.
  - Arabic price answers omitted exact catalog product identity; prompt and retry gates now require exact product name and price.
  - Related-product comparison asked the shopper which related item to compare; prompt now uses the first related catalog item when unspecified.
  - Shipping answers paraphrased required catalog facts; regression requires `Complimentary shipping` and `returns`.
  - Material, size, and variant answers missed required catalog facts or were truncated; live retry gates now catch those cases.
  - Public API returned provider/model/token metadata; route now returns only safe UI fields.
  - Product pages emitted NextAuth session 500s in production demo mode; demo-mode auth fallback fixed `/api/auth/session`.
  - Playwright and Vitest defaults still allowed the previous local response mode; local test setup and quality scripts now load `.env.local` and run live by default.
- Tests and checks run:
  - `pnpm run typecheck` PASS
  - `pnpm run lint` PASS
  - `pnpm run test:unit` PASS, 4 files / 22 tests
  - `pnpm run test:integration` PASS, 2 files / 9 live-route tests
  - `pnpm run test:agent:live` PASS, 60 live cases, 9.4/10 average, 0 hard failures
  - `pnpm run test:e2e` PASS, 24 Playwright tests across desktop/mobile against `http://127.0.0.1:3000`
  - `pnpm run handoff:check` PASS
  - Direct live API check returned `mode: live` with no provider/model/token fields exposed.
  - UTF-8 Arabic API check for Everyday Leather Tote returned Arabic answer with product name and `320`.
  - Windows Defender custom scan of `C:\Users\PC\Downloads\lovable-project-e0708df1.zip`; no detections for that zip.
- Result:
  - Client handoff acceptance bar passed locally in live OpenRouter mode.
  - Registered preview server is healthy at `http://127.0.0.1:3000`.

## 2026-07-07 - Seller Knowledge Provider And Client Scenario Hardening

- Goal attempted: prove the product-page agent is not hardcoded to this store/products, run a larger client-like live scenario suite, and validate that dashboard insights reflect those conversations.
- Files changed:
  - `src/lib/knowledge/seller-knowledge.ts`
  - `src/lib/storage/json-store.ts`
  - `src/lib/agent/prompt-builder.ts`
  - `src/lib/agent/llm-client.ts`
  - `src/lib/agent/chat-service.ts`
  - `src/lib/agent/guardrails.ts`
  - `src/lib/agent/language.ts`
  - `src/lib/analytics/events.ts`
  - `src/lib/dashboard/aggregation.ts`
  - `src/app/api/events/route.ts`
  - `src/app/dashboard/products/page.tsx`
  - `src/app/dashboard/insights/page.tsx`
  - `tests/unit/seller-knowledge.test.ts`
  - `tests/unit/prompt-and-live.test.ts`
  - `tests/integration/agent-client-scenarios.test.ts`
  - `scripts/handoff-check.mjs`
  - `CLIENT_HANDOFF_ACCEPTANCE.md`
  - `AGENT_E2E_LOOP.md`
  - `HANDOFF_REPORT.md`
- Failures found and fixed:
  - Dashboard/local product changes were overwritten by seed catalog products on load; the JSON store now preserves dashboard products and merchants when present.
  - Agent prompt, chat service, events, and dashboard aggregation were still coupled to the demo catalog provider; they now consume a seller knowledge context that can later be backed by Salla or Zid APIs.
  - The 60-case live client-scenario suite caught budget objections and variant confusion returning `model_error`; grounding checks were narrowed to the exact shopper intent.
  - The full handoff suite caught Arabic size guidance falling back to `model_error`; a live LLM repair pass now revises weak provider answers against seller knowledge instead of using fake/local text.
- Tests and checks run:
  - `pnpm run lint` PASS
  - `pnpm run typecheck` PASS
  - `pnpm run test:unit` PASS, 5 files / 23 tests
  - `pnpm exec vitest run tests/integration/agent-eval.test.ts` PASS
  - `pnpm run test:agent:scenarios` PASS, 60 live client scenarios, 9.22/10 average, 0 hard failures
  - `pnpm run test:agent:live` PASS, 60 live matrix cases, 9.37/10 average, 0 hard failures
  - `pnpm run handoff:check` PASS
- Dashboard proof:
  - The client-scenario suite created 61 conversations, 124 messages, 41 objections, 27% unknown-answer rate, and 61 weak-description signals.
  - Browser E2E validated dashboard conversations, conversation detail transcript, insights, and dashboard navigation across desktop and mobile.
- Result:
  - Client handoff suite passed with real OpenRouter live mode.
  - The showcase agent now uses dashboard/store seller knowledge as its source of truth and is ready for provider substitution when Salla/Zid are connected.

## 2026-07-08 - Merchant Dashboard Integrations Removed

- Goal attempted: remove Integrations from the merchant dashboard UI while keeping provider wiring internal for future Salla/Zid API work.
- Files changed:
  - `src/components/dashboard/DashboardNav.tsx`
  - `src/app/dashboard/page.tsx`
  - `src/app/dashboard/integrations/page.tsx`
  - `tests/e2e/dashboard-insights.spec.ts`
  - `README.md`
  - `CLIENT_HANDOFF_ACCEPTANCE.md`
  - `HANDOFF_REPORT.md`
- Result:
  - Dashboard nav no longer shows Integrations.
  - Dashboard overview no longer links to `/dashboard/integrations`.
  - The `/dashboard/integrations` page was removed.
  - E2E now asserts merchant dashboard insights still work and the Integrations link is absent.

## 2026-07-08 - Agent Bag Capability Removed

- Goal attempted: remove "adding it to your bag" as an advertised or supported product-agent capability.
- Files changed:
  - `src/components/saleh-demo/store-i18n.ts`
  - `src/lib/agent/prompt-builder.ts`
  - `src/lib/agent/guardrails.ts`
  - `src/lib/agent/evaluator.ts`
  - `tests/unit/guardrails.test.ts`
  - `tests/unit/prompt-and-live.test.ts`
- Result:
  - English and Arabic agent greetings no longer mention adding products to the bag.
  - The system prompt now tells the live LLM not to offer bag, cart, checkout, or shopping actions.
  - Input requests like "Add it to my bag" are treated as out of scope.
  - Output claims like "I can add it to your bag" are blocked by output guardrails.
  - The evaluator no longer counts bag actions as valid soft CTAs.

## 2026-07-08 - CTO Loop Handoff Hardening Pass

- Goal attempted: continue the CTO v4 loop after a green handoff run, resolve reviewer risks, and prove the build is stable for client handoff readiness.
- Files changed:
  - `src/providers/NextAuthProvider.tsx`
  - `src/providers/GlobalProviders.tsx`
  - `package.json`
  - `tests/unit/prompt-and-live.test.ts`
  - `tests/e2e/dashboard-insights.spec.ts`
  - `README.md`
  - `PROJECT_GOALS.md`
  - `RUNBOOK.md`
- Failures found and fixed:
  - Desktop dashboard E2E caught aborted `/api/auth/session` polling from global NextAuth providers. Demo showcase routes now skip unnecessary customer auth polling while legacy customer/account routes keep the session provider.
  - Cold-start `typecheck` could depend on generated Next route types. `pnpm run typecheck` now runs `next typegen` before `tsc --noEmit`.
  - Dashboard Integrations removal had nav-level proof only. Unit coverage now asserts the route file is absent, and E2E asserts the merchant UI does not expose Integrations.
  - Live-provider resilience lacked direct regression coverage. Unit coverage now proves OpenRouter `rate_limited` and `no_credits` failures fall through to DeepSeek, and all-provider timeouts return a logged `model_error` fallback.
  - Support/rollback guidance was thin. `RUNBOOK.md` now covers readiness, preview recovery, OpenRouter/Supabase triage, dashboard checks, and rollback.
  - Final review found a hard-coded demo NextAuth session secret path. Removed it, added auth config regression coverage, and documented that customer/account auth requires explicit `NEXTAUTH_SECRET`.
- Focused checks run:
  - `pnpm run lint` PASS
  - `pnpm run typecheck` PASS
  - `pnpm exec vitest run tests/unit/prompt-and-live.test.ts` PASS, 7 tests
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 pnpm exec playwright test tests/e2e/dashboard-insights.spec.ts --project=chromium` PASS, 2 tests
- Final full gate:
  - `pnpm run handoff:check` PASS
  - Unit tests PASS, 7 files / 27 tests
  - Integration tests PASS, 2 files / 9 tests
  - Live agent quality PASS, 60 cases, 9.35/10 average, 0 hard failures
  - Live client scenarios PASS, 60 scenarios, 9.28/10 average, 0 hard failures
  - Browser E2E PASS, 30 tests across desktop and mobile

## Iteration 1

- Goal: Iteration 1: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 3
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 2

- Goal: Iteration 2: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 33
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 3

- Goal: Iteration 3: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 1
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 4

- Goal: Iteration 4: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 1
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 5

- Goal: Iteration 5: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 21
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 6

- Goal: Iteration 6: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; pnpm run handoff:check
- Screenshots captured: yes, when screenshot step completed
- Findings found: 0
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: clean checkpoint
- Next goal: fix findings or run next clean loop

## Iteration 7

- Goal: Iteration 7: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; pnpm run handoff:check
- Screenshots captured: yes, when screenshot step completed
- Findings found: 0
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: clean checkpoint
- Next goal: fix findings or run next clean loop

## Iteration 8

- Goal: Iteration 8: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 1
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 9

- Goal: Iteration 9: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; full gate skipped
- Screenshots captured: yes, when screenshot step completed
- Findings found: 26
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: findings remain
- Next goal: fix findings or run next clean loop

## Iteration 10

- Goal: Iteration 10: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run build; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; pnpm run handoff:check
- Screenshots captured: yes, when screenshot step completed
- Findings found: 0
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: clean checkpoint
- Next goal: fix findings or run next clean loop

## Iteration 11

- Goal: Iteration 11: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run build; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; pnpm run handoff:check
- Screenshots captured: yes, when screenshot step completed
- Findings found: 0
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: clean checkpoint
- Next goal: fix findings or run next clean loop

## Iteration 12

- Goal: Iteration 12: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.
- Commands run: pnpm run generate:demo-assets; pnpm run seed:demo; pnpm run build; pnpm run screenshots:products; pnpm run audit:product-pages; pnpm run test:e2e:product-pages; pnpm run test:e2e:agent; pnpm run test:agent:quality; pnpm run audit:dashboard; pnpm run test:e2e:dashboard; pnpm run handoff:check
- Screenshots captured: yes, when screenshot step completed
- Findings found: 0
- Fixes made: by Codex outside this loop script
- Regression tests added: tracked in code changes and E2E/integration suites
- Final status: clean checkpoint
- Next goal: client handoff ready

## Post-Ready Live Smoke

- Goal: Verify the real OpenRouter agent path after deterministic readiness passed.
- Finding found: live Arabic/product-fact cases translated catalog facts without exact catalog phrases, causing hard known-fact failures in the live matrix.
- Fix made: added live response grounding post-processing from the current product catalog context before output guardrails.
- Commands run: pnpm run test:agent:live; pnpm run handoff:check
- Result: live smoke PASS, deterministic handoff gate PASS.
- Reports: AGENT_QUALITY_REPORT_LIVE.md, AGENT_QUALITY_REPORT_LIVE.json, AGENT_QUALITY_REPORT.md, HANDOFF_REPORT.md.

## 2026-07-08 - CTO Loop Current-State Reinspection

- Goal attempted: restart the continuous CTO-loop from current evidence, identify the authoritative repo, and update the real current-state plan before further implementation.
- Skill used: `cto-loop` v4.
- Graphify used:
  - `bagisto-nextjs-commerce/graphify-out/GRAPH_REPORT.md`
  - `graphify query "map the demo storefront product agent dashboard data layer tests ci deployment model config routes"`
- Repo/root findings:
  - `E:\Saleh`s AI\bagisto-nextjs-commerce` is the only git repository and the authoritative Bagisto/Maison Vert handoff target.
  - The parent `E:\Saleh`s AI` directory contains a separate Next app scaffold with its own `package.json`, `src`, `tests`, and dashboard/product routes. It is outside the git root and should not be treated as the client handoff app unless intentionally migrated in a separate cleanup goal.
- Stack detected:
  - Package manager: pnpm (`pnpm-lock.yaml`, `packageManager: pnpm@11.7.0`).
  - Framework: Next.js app router.
  - Data layer: seeded local JSON/memory store, Prisma schema validation, optional Supabase server persistence.
  - AI/model config: Ting-style route order in `src/lib/ai/model-config.ts`; deterministic `AGENT_MODE=mock`; live OpenRouter/DeepSeek route chain for smoke validation.
  - Tests/gates: Vitest unit/integration, Playwright E2E, screenshot/product/dashboard audits, agent quality matrix, `pnpm run handoff:check`, `pnpm run handoff:loop`.
  - CI/CD/deployment: `.github/workflows/ci.yml`, `vercel.json`, README deployment notes.
- Findings:
  - `PROJECT_GOALS.md` had stale copy saying the merchant dashboard Integrations route was removed, but current code, tests, and `HANDOFF_REPORT.md` validate `/dashboard/integrations` as the provider-status stub page.
- Fix made:
  - Updated `PROJECT_GOALS.md` with the real current state, authoritative root, current stack, readiness evidence, integration stub status, and parent-scaffold risk.
- Verification:
  - `pnpm run handoff:check` PASS after the documentation correction.
  - The gate reran secret scan, asset generation, seed, Prisma schema validation, lint, typecheck, unit tests, integration tests, product-page E2E, agent E2E, dashboard E2E, deterministic agent quality, screenshot audit, product-page audit, dashboard audit, and production build.
- Next true constraint:
  - No P0/P1/P2 product, agent, dashboard, CI, or build constraint remains in current evidence. Future work remains Salla/Zid real adapter implementation after demo approval, outside this showcase phase.

## 2026-07-08 - Product-Page-Only Agent Popup

- Goal: make the chat agent appear only on product pages, open immediately there, and greet with the current product context.
- Fixes made:
  - Removed the home-page `AgentWidget` mount.
  - Added explicit product-page `defaultOpen` behavior and instant first assistant greeting.
  - Kept typewriter behavior for later assistant responses.
  - Moved the auto-open product-page panel to the left side on desktop so it does not block size, color, add-to-bag, or checkout interactions.
  - Updated product-page and screenshot audits for the new auto-open requirement.
  - Hardened screenshot capture to use production preview evidence and avoid dev HMR/caret hydration noise.
- Regression tests added or updated:
  - Home page must have no agent widget.
  - Product page must auto-open the agent and show the current product name in the first assistant message.
  - Product options, add-to-bag, cart, checkout, Arabic toggle, and responsive chat behavior still pass with the auto-open panel.
- Commands run:
  - `pnpm -s exec tsc --noEmit --pretty false`
  - `pnpm exec playwright test tests/e2e/agent-shopping.spec.ts tests/e2e/demo.spec.ts tests/e2e/storefront-products.spec.ts --project=chromium`
  - `pnpm run audit:product-pages`
  - `pnpm run build`
  - `pnpm run audit:screenshots`
  - `pnpm run lint`
- Result:
  - Focused E2E PASS on production preview.
  - Product page audit PASS with 0 findings.
  - Screenshot audit PASS with 32 screenshots captured.
  - Build, typecheck, and lint PASS.

## 2026-07-09 - Locale-Aware Agent Placement

- Goal: place the product-page agent on the right in English and on the left in Arabic.
- Fixes made:
  - Removed the product-page forced-left placement override so `AgentWidget` uses its locale-aware default placement.
  - Updated commerce E2E flows to close the auto-open chat before selecting product options or checkout actions.
  - Added a Playwright regression that verifies English/right and Arabic/left placement on the product page.
- Commands run:
  - `pnpm -s exec tsc --noEmit --pretty false`
  - `pnpm run build`
  - `pnpm exec playwright test tests/e2e/agent-shopping.spec.ts tests/e2e/demo.spec.ts --project=chromium`
  - `pnpm run audit:product-pages`
  - `pnpm run audit:screenshots`
  - `pnpm run lint`
- Result:
  - Locale placement regression PASS.
  - Product page audit PASS with 0 findings.
  - Screenshot audit PASS with 32 screenshots captured.

## 2026-07-09 - Hidden Transcript Download And Local Agent State

- Goal: add the hidden open-chat avatar transcript download and preserve product-agent conversation state across route changes using the same session-first local persistence pattern as the Ting website agent.
- Fixes made:
  - Added sessionStorage-backed product/locale conversation persistence with legacy localStorage migration and reset cleanup.
  - Restored saved messages and conversation id after navigating away from and back to the same product page.
  - Kept new sends grounded to the current product slug and page context.
  - Added hidden transcript download from the open-chat avatar button.
  - Transcript format uses `Agent:` and `User:` labels and downloads as a `.txt` file.
- Regression tests added:
  - Product-page agent persists local conversation state across route changes.
  - Open-chat avatar downloads the conversation transcript as text.
- Commands run:
  - `pnpm -s exec tsc --noEmit --pretty false`
  - `pnpm run lint`
  - `pnpm run build`
  - `pnpm exec playwright test tests/e2e/agent-shopping.spec.ts --project=chromium`
  - `pnpm exec playwright test tests/e2e/demo.spec.ts tests/e2e/storefront-products.spec.ts --project=chromium`
  - `pnpm run audit:product-pages`
  - `pnpm run audit:screenshots`
  - `pnpm run handoff:check`
- Result:
  - Agent E2E PASS on desktop/mobile, including transcript download and route-change persistence.
  - Product page audit PASS with 0 findings.
  - Screenshot audit PASS with 32 screenshots captured.
  - Full handoff gate PASS.

## 2026-07-09 - Fast Local Transcript Cache With Backend Transcript Source

- Goal: keep the product-agent transcript available instantly from browser cache while still storing the full authoritative conversation in the backend.
- Fixes made:
  - Added a shared product-agent welcome builder used by the widget and backend.
  - Stored the initial assistant welcome message when a backend conversation is first created, so backend transcripts match the visible widget transcript.
  - Added guarded `GET /api/agent/chat` transcript hydration by `conversationId`, `productSlug`, and anonymous `visitorRef`.
  - Updated the widget cache to write both `sessionStorage` and `localStorage`, including `visitorRef`, `conversationId`, messages, open state, page URL, sync timestamp, and update timestamp.
  - Added backend reconciliation after local hydration so cached messages render immediately and backend transcript wins when available, without overwriting newer unsynced local user turns.
- Regression tests added:
  - Agent API stores welcome + user + assistant for new conversations.
  - Agent API returns full transcript only for the matching anonymous visitor and product.
  - Product-agent E2E verifies local cache exists, backend transcript has `assistant/user/assistant`, and route-change restore still works.
- Commands run:
  - `pnpm -s exec tsc --noEmit --pretty false`
  - `pnpm exec vitest run tests/integration/agent-api.test.ts`
  - `pnpm run build`
  - Preview server manager reused/started `http://127.0.0.1:3002`; stale duplicate dev process was removed.
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 pnpm exec playwright test tests/e2e/agent-shopping.spec.ts --project=chromium`
  - `pnpm run lint`
- Result:
  - Backend full transcript storage PASS.
  - Local fast transcript cache and backend reconciliation E2E PASS.
  - Typecheck, build, focused integration, focused E2E, and lint PASS.

## 2026-07-08 - Live Agent QA Iteration 1

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=18, P1=5, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: findings remain
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 2

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 11
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=1, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: findings remain
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 3

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim
- Conversation count: 3
- Languages: en
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: findings remain
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 4

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 5

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=2, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: findings remain
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 6

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 7

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-08 - Live Agent QA Iteration 8

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-09 - Live Agent QA Iteration 9

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 22
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-09 - Live Agent QA Iteration 10

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-09 - Live Agent QA Iteration 11

- Goal: run real live agent QA against http://127.0.0.1:3002.
- Live server URL: http://127.0.0.1:3002
- Products selected: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
- Conversation count: 25
- Languages: en, ar
- Commands run: node scripts/live-agent-qa.mjs
- Failures found: P0=0, P1=0, P2=0
- Files changed: live QA reports and loop state.
- Deployment/restart status: live server health checked before QA.
- Live retest status: clean batch
- Dashboard verification: checked
- Next goal: fix open P0/P1/P2 findings and rerun live QA.

## 2026-07-09 - Ting EN/AR Agent Route Parity Slice

- Goal: replicate Ting website route-first EN/AR language switching, product-agent welcome behavior, and left/right placement logic.
- Changes made: added `/ar` storefront/product/cart/category aliases, made store locale derive from the route, localized product and navigation links, changed agent state to session-first product-key storage with legacy localStorage migration, mirrored Arabic widget alignment/origin, and skipped auth session fetches for `/ar` demo routes.
- Regression tests added/updated: `tests/unit/store-locale.test.ts`, `tests/e2e/agent-shopping.spec.ts`, `tests/e2e/storefront-products.spec.ts`.
- Commands run: `pnpm exec vitest run tests/unit/store-locale.test.ts`, `pnpm exec tsc --noEmit --pretty false`, `pnpm run build`, `pnpm exec playwright test tests/e2e/agent-shopping.spec.ts --project=chromium --workers=1`, `pnpm exec playwright test tests/e2e/storefront-products.spec.ts --project=chromium --workers=1`.
- Preview server: restarted registered same-project server through preview-server-manager; URL `http://127.0.0.1:3002`; duplicateCount=0.
- Manual probe: `/product/everyday-leather-tote` rendered `lang=en`, `dir=ltr`, widget centerX=1196; `/ar/product/everyday-leather-tote` rendered `lang=ar`, `dir=rtl`, widget centerX=244; `/ar` homepage rendered no agent widget.
- Findings fixed: P1 hydration error on `/ar` from SSR/client locale mismatch; P1 NextAuth session 500 on `/ar` demo routes.
- Status: focused parity slice passed.

## 2026-07-09 - Ting Agent Core Persistence and Fast Language Switch Slice

- Goal: bring the Maison Vert product-page agent closer to Ting Website behavior for EN/AR switching, welcome-message reveal, and conversation persistence without turning the assistant into a hardcoded bot.
- Changes made: replaced the two-button language switch with the Ting-style dropdown route switch, prefetches both EN/AR product routes, mirrors Ting's route-derived `/ar` path logic, remounts the widget on locale/product changes, animates fresh assistant welcome and reply text with a typewriter reveal, and splits agent session state into session-first `session-id`, `messages`, `memory`, and compatibility snapshot records per product slug.
- Persistence behavior: active shopper conversations stay in `sessionStorage` for fast route-to-route restore, legacy `localStorage` values are migrated and removed, assistant-only stale welcomes are replaced by the current product/locale welcome, and the backend transcript remains the durable full conversation source through the existing agent API.
- API behavior: `/api/agent/chat` now accepts safe `sessionId`, `conversationHistory`, and `memory` fields from the widget while keeping the real prompt, guardrail, provider, logging, insight, and dashboard pipeline intact.
- Regression tests added/updated: `tests/unit/store-locale.test.ts`, `tests/e2e/agent-shopping.spec.ts`, `tests/e2e/storefront-products.spec.ts`.
- Commands run: `pnpm exec vitest run tests/unit/store-locale.test.ts`, `pnpm exec tsc --noEmit --pretty false`, `pnpm run lint`, `pnpm run build`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 AGENT_MODE=mock pnpm exec playwright test tests/e2e/agent-shopping.spec.ts --project=chromium --workers=1`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3002 AGENT_MODE=mock pnpm exec playwright test tests/e2e/storefront-products.spec.ts --project=chromium --workers=1`.
- Manual probe: `/product/everyday-leather-tote` welcome text revealed progressively (`typewriterProgressed=true`); EN to AR switch completed in 145 ms in deterministic preview; Arabic product route rendered `lang=ar`, `dir=rtl`, widget on the left, and product-specific Arabic welcome text.
- Live preview status: registered same-project server is `http://127.0.0.1:3002`; `/api/agent/health` reports `agentMode=live`, provider `openrouter`, catalog logging enabled, and insights enabled. A live `/api/agent/chat` smoke for `everyday-leather-tote` returned `mode=live`, conversation `cf2e9c81-00c9-4673-b34a-a890a9e470ba`, and a grounded work-practicality answer.
- Findings fixed: P1 slow/heavy EN/AR switching caused by non-prefetched button route changes; P2 welcome rendered fully instead of Ting-style fresh assistant typewriter reveal; P1 conversation state was snapshot-only instead of Ting-like separate session/message/memory records.
- Status: focused Ting agent core parity slice passed.

## 2026-07-13 - Live-Only Agentic LLM Showcase Hardening

- Removed the entire deterministic English/Arabic mock-answer engine and made `AgentMode` live-only; shopper answers can no longer silently fall back to canned regex templates.
- Added trusted server-side transcript memory to OpenRouter/DeepSeek chat-completion calls so follow-up questions retain the shopper's prior needs and the agent's prior guidance.
- Kept deterministic safety, rate-limit, missing-data, and provider-error responses as guardrails, while all valid product advice is generated by the live LLM from seller knowledge.
- Changed catalog-grounding repair to best-effort so a safe live answer is not discarded into `model_error` solely because a strict wording heuristic could not improve it.
- Updated CI and handoff configuration: deterministic tests mock only the provider boundary; full client handoff requires a configured live provider key.
- Fixed the language-menu stacking layer above the open agent panel and updated the stale Arabic-toggle E2E selector.
- Verification: lint clean; typecheck clean; production build clean; 36 unit tests; 11 integration tests; 16 product E2E tests; 14 agent E2E tests; 6 dashboard E2E tests; 32 screenshot audit captures; product and dashboard audits with zero findings.
- Live quality matrix: 102/102 cases passed, 9.82/10 average, 100% known-fact accuracy, 100% missing-data fallback correctness, 100% safe refusal handling, zero hard failures.
- Preview ownership: preview-server-manager started `http://127.0.0.1:3004` with `duplicateCount=0`; it was cleaned up before the final production build.
- Graphify: `graphify update .` completed after the code changes.

## 2026-08-03 - Supabase Merchant Dashboard Sprint

- Reconciled the active nested pnpm/Next.js repository and used Graphify for the first-pass architecture map.
- Added a versioned 18-table merchant schema plus analytics, UUID ownership, indexes, updated-at triggers, role helper functions, and restrictive RLS. Earlier text-key demo tables are preserved under legacy names when present.
- Updated the ignored local environment to the supplied Supabase project without committing secrets; migrated and idempotently seeded the live project.
- Added explicit Supabase/local backend selection, typed browser/server/service seams, Supabase dashboard data hydration, and production Auth enforcement with local test fallback.
- Added merchant roles, login/callback/logout, viewer prompt isolation, advanced route guards, and disposable-user RLS verification.
- Implemented the Agent, Advanced Settings, Prompt Versions, Playground, QA, and Audit Log routes; added audited draft/QA/publish/rollback/archive actions and non-removable runtime guardrails.
- Wired the live agent to active Supabase prompt version 1 and durable conversation/message/insight/audit writes. Verified a real live conversation and its dashboard transcript.
- Added conversation filters and telemetry, transcript copying, quality ratings, admin notes, manual insights, insight status workflow, and product completeness scores.
- QA loop results to date: typecheck passed; 45 unit tests passed; 11 integration tests passed; production build passed; Supabase RLS verification passed; live governance E2E passed.
- Preview Server Manager started the registered production preview at `http://127.0.0.1:3001` with duplicateCount=0.
- Next: final full E2E, active-config quality matrix, production rebuild, Graphify update, and handoff status flip.

## 2026-08-03 - Supabase Dashboard Client Handoff Completion

- Completed the full `pnpm run handoff:check` with 16 product E2E, 14 agent E2E, 6 dashboard E2E, 32 screenshot captures, zero product-audit findings, zero dashboard-audit findings, and a passing final production build.
- Completed the regular cross-device browser run with 36 passing cases; the two prompt-governance cases were intentionally run separately and passed on Chromium and mobile.
- Completed live active-config QA run `9f405e85-1605-481c-937e-9f9eb79b3442`: 102/102 cases passed, 9.72/10 average, 100% at 8+, 100% known-fact accuracy, 100% missing-data fallback correctness, 100% safe-refusal handling, and zero hard failures.
- Confirmed 45 unit tests, 11 integration tests, lint, typecheck, secret scanning, live migration/seed, disposable-user RLS verification, anonymous prompt isolation, and durable live widget persistence all passed.
- Confirmed prompt governance end to end: draft, QA, publish, rollback, and archive. Prompt version 1 is active via the audited rollback path.
- Registered production preview remains `http://127.0.0.1:3001` with duplicateCount=0.
- Client handoff status is ready. Production deployment still requires the real client owner email/Auth UUID and `NEXT_PUBLIC_DEMO_MODE=false`; Salla/Zid connectivity remains future work.

## 2026-08-03 - Requirement-by-Requirement Completion Audit and Hardening

- Audited the full sprint specification against current source, live Supabase state, browser behavior, and test coverage instead of relying on the earlier handoff flag.
- Closed missing feature gaps: versioned tone/language/model/context/objection/fallback/guardrail settings; live eight-case draft QA with persisted cases; playground QA-case saving; actual prompt comparison; content suggestions; insight evidence links; most-active-product KPIs; team roles; integration scopes; and audited retention/refresh preferences.
- Hardened service-role conversation review actions with explicit `merchant_id` constraints and hid mutation controls from viewer roles.
- Replaced static dashboard QA claims with real English/Arabic fact, hesitation, objection, missing-data, injection, prompt-disclosure, and payment-data evaluation using the exact candidate configuration.
- Fixed an intermittent Arabic catalog-grounding failure by adding a second live repair and advancing twice-under-grounded output to the next configured live provider route. The focused Arabic integration suite passed five consecutive reruns.
- Live governance passed on Chromium and mobile, including behavior-setting publish/rollback, playground QA persistence, audited settings changes, and restoration of prompt version 1.
- Supabase RLS verification passed again. Active-config QA run `69024e5a-4604-4002-b8e1-3a7c549e9eaa` passed 102/102 at 9.66/10 with zero hard failures.
- Final `pnpm run handoff:check` passed: secret scan across 600 files, schema/type/RLS checks, lint, typecheck, 47 unit tests, 11 integration tests, 16 product E2E, 14 agent E2E, 6 dashboard E2E, 32 screenshots, zero product/dashboard audit findings, 102-case quality matrix at 9.68/10, and production build.
- Preview Server Manager started the rebuilt production preview at `http://127.0.0.1:3001` (PID 24984) with duplicateCount=0.

## 2026-08-03 - Merchant-Agnostic Platform Foundation Completion

- Corrected the canonical scope: the demo storefront is only the fake pilot merchant and QA/catalog harness; the deliverable is the Supabase-backed AI Sales Agent platform for Salla/Zid merchants.
- Added the merchant-scoped public widget/embed surface, Supabase tenant/product resolution, provider manifests and normalized catalog boundary, Salla/Zid OAuth/webhook/sync placeholders, integration readiness UI, and validated CSV import fallback.
- Added and applied `202608030002_platform_foundation.sql` for merchant public keys/origins, provider-aware integrations and sync jobs, webhook events, hashed OAuth state, indexes, grants, and RLS. Live migration, idempotent seed, platform verification, and disposable-user RLS verification passed.
- Hardened runtime ownership: conversation continuation now checks merchant, product, and anonymous visitor; telemetry and insight aggregation are merchant-scoped; transient Supabase catalog queries retry; external embed configuration exposes no prompt or server secrets and unapproved providers fail closed.
- Added platform unit/integration/E2E evidence and updated stale integration-status assertions to verify the current fail-closed OAuth/token-vault contract.
- Final `pnpm run handoff:check` passed in the clean build/server sequence: secret scan across 617 files, schema/platform/RLS verification, lint, typecheck, 52 unit tests, 11 handoff integration tests, 16 product E2E, 18 agent/embed E2E, 6 dashboard E2E, 102/102 live quality cases at 9.69/10, 32 screenshots, zero product/dashboard audit findings, and two production builds.
- Preview Server Manager started the final healthy production preview at `http://127.0.0.1:3001` (PID 20348) with `duplicateCount=0`.
- Handoff boundary: production still requires the real owner email/Auth UUID, `NEXT_PUBLIC_DEMO_MODE=false`, production domain/secrets/origins, and deployment. Salla/Zid remain an external integration milestone, not a connected feature claim.

## 2026-08-13 - Master Checklist Re-Audit and Local Recovery

- Re-audited the complete 40-section product gate and corrected the project identity/docs: Maison Vert is only the demo merchant; Nbeh is the merchant-installable Salla/Zid AI Sales Agent platform.
- Found that the previous Supabase hostname no longer resolves and that Vercel Production has no Supabase variables. Replaced stale handoff claims with `READY_FOR_CLIENT_HANDOFF=false` and a precise recovery runbook.
- Hardened production backend selection and the handoff gate so production cannot silently use local/demo persistence and local evidence cannot satisfy the Supabase handoff requirement.
- Recreated one registered preview at `http://127.0.0.1:3000` with explicit local/demo settings and freshly seeded data; no duplicate same-project server was created.
- Corrected stale E2E routing and branded-widget assertions without changing the exact landing asset. Product E2E passed 16/16, agent/embed 18/18, dashboard 8/8, and full local E2E 42 passed with the two Supabase-only governance cases intentionally skipped.
- Hardened public and dashboard JSON error boundaries: validation errors are bounded, unexpected service/database failures return generic 503 responses, and browser responses do not echo internal exception text.
- Updated the live governance browser test for the custom Nbeh dropdown and documented same-origin/server-action CSRF posture.
- Landing SHA-256 remains `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- Current status remains blocked until a reachable Supabase project is migrated/seeded, owner membership and RLS are reverified, production variables are deployed, and `pnpm run handoff:check` passes.

## 2026-08-13 - Privacy-Preserving Abuse Controls and Final Local Regression

- Added a service-role-only `request_rate_limit_buckets` table and atomic `consume_request_rate_limit` RPC with independent `shopper_chat` and `founder_login` scopes.
- Added a server-only HMAC fingerprint derived only from Vercel's overwritten forwarding header or an explicitly trusted self-hosted proxy. Raw client IPs and forwarding headers are never persisted.
- Closed shopper `visitorRef` rotation bypass, added HTTP 429/`Retry-After`, and stopped rejected requests from creating conversations, messages, insights, or analytics artifacts.
- Added independent Founder throttling (8 attempts per 15 minutes) and changed ordinary merchant login to bypass the Founder endpoint before Supabase Auth.
- Documented the iframe-contained same-origin widget API/CORS boundary and extended the live RLS verifier to prove the abuse table/RPC are unavailable to anonymous and authenticated dashboard clients.
- Verification: lint passed; typecheck passed; 91 unit tests passed; 25 integration tests passed; production build generated 25/25 static pages; secret scan passed across 661 files; local production E2E passed 42 with exactly two live-Supabase governance cases skipped.
- Interactive browser QA passed for desktop/mobile login, dashboard navigation, advanced Nbeh settings, and the custom styled dropdown open/keyboard-selection state with no page or console errors.
- Registered preview was started at `http://127.0.0.1:3000` (PID 26772) through the preview manager with `duplicateCount=0` and explicit local/demo settings.
- Landing remains byte-identical to `nabih-landing-3.html` at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- Handoff remains blocked solely by the unreachable/missing production Supabase project and its absent Vercel variables; no false readiness flag was set.

## 2026-08-13 - Supabase Account-State Verification

- Rechecked the replacement-backend path without exposing credential values: the Supabase CLI reports no access token, no access token exists in the process/user/machine environment, and the local Supabase config contains telemetry only.
- Opened a fresh isolated headed browser session at the Supabase dashboard; it remains on the sign-in page, so no Nbeh organization or project ownership can yet be verified.
- Did not create a project, choose an organization, or configure billable resources because doing so before the intended new Nbeh account is authenticated could place the platform under BTKK1 or another ambiguous owner.
- Updated the handoff blocker and setup runbook. `READY_FOR_CLIENT_HANDOFF` remains false pending authenticated Nbeh account access, live migration/seed/RLS verification, Vercel Production configuration, deployment, and the complete handoff gate.
- Re-ran the current external checks: the old Supabase hostname is NXDOMAIN, platform and RLS verification fail at network resolution, the strict handoff command rejects demo mode, and Production health still reports the older `demo_catalog` runtime without the current backend/abuse-control fields.
- Confirmed Vercel CLI ownership is `nbehsolution-2378` and the production variable inventory still lacks every Supabase credential plus `AGENT_RATE_LIMIT_SECRET`; the commit-candidate secret scan continues to pass across 661 files.

## 2026-08-13 - Founder Playground And Demo Store Discoverability

- Removed the Founder/advanced-user product picker from the Agent Playground. A demo-store product context is attached automatically and remains visible only as a safe context summary after a run.
- Reframed comparison output as two full Nbeh chat agents: `Live Agent` shows what shoppers see now; `Draft Agent` shows unpublished behavior or an explicit create-draft state when no candidate exists.
- Added prominent demo-store links in the Playground header/context card, Founder dashboard top bar, and Founder-styled sidebar CTA. All external-tab links use `noopener noreferrer`.
- Fixed local loopback same-origin validation so `localhost` and `127.0.0.1` are equivalent only when both are loopback with identical protocol and port; production/cross-origin enforcement remains strict.
- Browser QA passed on desktop and 390px mobile. The demo-store link opens `/store`, and a real playground question renders the Live Agent chat with version/model/safety metadata while the Draft Agent remains a separate waiting state.
- Focused regression tests, lint, typecheck, and the 25-page production build passed. The registered preview was restarted with the current build at `http://127.0.0.1:3000`, PID 34184, with no Nbeh duplicates.
- Security incident: a malformed local Windows environment-import diagnostic printed the Vercel Blob read/write token to command output. The ignored export was deleted immediately and no token value was committed or copied into documentation. Before production deployment, the empty private `nbeh-global-config` store was deleted and recreated in `iad1`, rotating the persistent token and reconnecting a fresh encrypted `BLOB_READ_WRITE_TOKEN` to Production and Preview without data loss.

## 2026-08-14 - Vercel Production Deployment

- Deployed the complete current worktree to the existing `nbeh-ai` project under the `nbehsolution-2378` Vercel account and promoted deployment `dpl_3jV26wrVjGDfiCGJ812KTBhBikmB` to `https://www.nbeh.io`.
- Rotated the previously exposed Blob credential before deployment by deleting the exact empty private store and recreating `nbeh-global-config` in `iad1`; Vercel connected a fresh token to Production and Preview. The old store had `0B` and `0 files`, so no data was removed.
- Replaced the empty/mismatched Founder credential variables with a fresh random salt, scrypt hash for the requested password, new session secret, and normalized Founder email. Verified the stored non-secret-encrypted values cryptographically before redeploying.
- Live browser QA passed: Founder login returned 200 and landed on `/dashboard`; Founder/Global Agent identity was visible; `/dashboard/agent/playground` showed the Live Agent and Draft Agent without a product picker; a real Live Agent prompt returned a grounded answer; and Founder demo-store links opened `/store`.
- Live route probes passed for `/`, `/store`, `/login`, and `/api/agent/health`. The landing response SHA-256 exactly matches `nabih-landing-3.html` (`EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`).
- Production health now exposes the current backend/abuse-control fields and truthfully reports `dataBackend=local`, `catalogProvider=demo_catalog`, and configured demo persistence/abuse controls. The deployment is live, but full client handoff remains blocked until the replacement Supabase project is authenticated, migrated, seeded, verified, and configured in Vercel.
# 2026-08-14 — Dashboard bilingual usability pass

- Added a persistent English/Arabic switch to the authenticated dashboard shell.
- Added full RTL/LTR switching and Arabic date formatting across dashboard tables and governance history.
- Localized dashboard navigation, headings, page purposes, filters, custom dropdowns, forms, statuses, empty/error states, pagination, settings, integrations, Founder controls, Playground, QA, and prompt-version actions.
- Rewrote internal product language into clear user outcomes, including the draft → test → publish workflow and recovery actions.
- Fixed Audit Log in the local/demo backend by normalizing local audit records instead of requiring Supabase.
- Browser-audited every dashboard route in both languages and verified Arabic at 390×844 mobile viewport.
- Verified custom model/provider menus in Arabic and Founder access to the demo store.
- Passed lint, TypeScript, 27 test files / 123 tests, production build, and commit-candidate secret scan.
- Deployed Vercel production deployment `dpl_543Qv4rVi4ggYizb41DRPzxgXJQB`, aliased to `https://www.nbeh.io`.
- Confirmed the production landing page remains byte-identical to `nabih-landing-3.html` (SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`).

## 2026-08-14 - Demo Store Nbeh Restoration And Automatic Language Detection

- Restored the branded Nbeh launcher on the demo-store homepage; it had only been mounted on product-detail pages. The homepage uses the first demo product as automatic grounding context.
- Removed the Playground shopper-language control and its visible helper copy. Both the browser and server now derive Arabic or English exclusively from the shopper's latest message; the server ignores any stale or conflicting client locale.
- Added regression coverage for the homepage widget, absence of the language UI, and server-side latest-message detection.
- Verification passed: typecheck, lint, secret scan, 17 focused unit/integration tests, production build, Graphify refresh, and live browser checks for Arabic and English Playground replies.
- Deployed Vercel production deployment `dpl_2DQHHp3Psu37yTSmJRyeXyAuNfxw` to `https://www.nbeh.io`. `/store` exposes and opens `Chat with Nbeh`; `/api/agent/health` returns HTTP 200.
- Production landing remains byte-identical to `nabih-landing-3.html` at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- `READY_FOR_CLIENT_HANDOFF=false` remains unchanged because production still reports `dataBackend=local` pending the Supabase recovery.

## 2026-08-14 - Product-Aware Playground And Local Governance Reliability

- Diagnosed the production draft failure from Vercel logs: `savePromptDraftAction` entered a Supabase-only write path while Production intentionally runs `DATA_BACKEND=local`, then failed because `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are absent.
- Added encrypted local/Vercel Blob administration persistence for prompt versions, active-version selection, QA runs, and audit evidence. Vercel uses the existing private Blob connection and `GLOBAL_AGENT_CONFIG_SECRET`; local development uses an ignored machine-local key.
- Added backend-aware draft, QA, publish, rollback, archive, Playground QA-case, preference, conversation-review, and insight mutations so demo/local operation does not call Supabase.
- Restored a branded product-page picker to the Agent Playground. Both Live Agent and Draft Agent receive the same selected catalog context, changing products clears stale output, and the demo-product link follows the selection.
- Replaced the generic dashboard crash screen with a branded recovery boundary and added inline action notices/errors to prompt governance pages.
- Added a browser regression that creates a draft, selects `Everyday Leather Tote` with a mouse click, verifies the updated product link, tests both agents, and persists the comparison as a QA case.
- Added encrypted-store unit coverage and made the Arabic quality evaluator accept equivalent grounded catalog terms such as denim, jeans, or selvedge.
- Verification passed: lint, typecheck, production build, secret scan, 28 test files / 129 tests, focused Chromium browser regression, Graphify refresh, and byte-identical landing verification.
- Landing SHA-256 remains `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- `READY_FOR_CLIENT_HANDOFF=false` remains unchanged because Supabase/Auth/RLS production recovery is still outside this demo/UI reliability release.
- Fixed the production-only Vercel Blob conditional-write edge case by normalizing quoted/weak HTTP ETags before `ifMatch`; the live Playground QA save then returned HTTP 200 with durable QA case/run identifiers.
- Deployed production `dpl_Gjg4zvVQGF5xj8w9NmhDMLV5yHFW` to `https://www.nbeh.io`.
- Live Founder verification passed: draft save, full eight-case QA, publish, archive, rollback to version 2, restore version 1, create final draft version 3, mouse product selection, two-agent guardrail comparison, QA-case persistence, and all dashboard route probes. The final live state keeps version 1 active and version 3 as the unpublished Playground draft.
- Final Production health returned HTTP 200 and the post-deployment Vercel error-log query returned no errors.

## 2026-08-14 - Arabic Dashboard Hydration Reliability

- Reproduced React error `#418` on a production hard load of `/dashboard/agent/advanced` with the Arabic dashboard cookie.
- Removed the dashboard `MutationObserver` text rewriter that could modify nested client-component text before hydration completed.
- Added React-rendered client translations and server-rendered page translations across all 14 dashboard page entry points, preserving RTL/LTR behavior and language switching without DOM mutation.
- Added a hard-load regression that asserts Arabic HTML direction and headings, navigates to the product-aware Playground, and fails on browser console, page, request, or hydration errors.
- Verification passed: lint, TypeScript, 103 unit tests, 27 integration/scenario/quality tests, six local dashboard browser flows with one Supabase-only case skipped, production build, secret scan, Graphify refresh, and byte-identical landing verification.
- Deployed production `dpl_D4NmdzxaV2GqNv83mEKayRJ3Gw8Q` to `https://www.nbeh.io`.
- Live Founder verification produced no errors after the Arabic toggle, client navigation, or hard Arabic navigation. Production health returned HTTP 200 and the post-deployment Vercel error-log query returned no errors.
- Production landing remains byte-identical to `nabih-landing-3.html` at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- `READY_FOR_CLIENT_HANDOFF=false` remains unchanged because the Supabase/Auth/RLS recovery is separate from this demo/UI reliability release.
