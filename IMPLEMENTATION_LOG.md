# Implementation Log

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
