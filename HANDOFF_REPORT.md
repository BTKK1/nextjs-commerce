# Client Handoff Report

READY_FOR_CLIENT_HANDOFF=false
FULL_HANDOFF_CHECK=BLOCKED
BLOCKER=SUPABASE_PROJECT_UNREACHABLE_NO_AUTHENTICATED_NBEH_ACCOUNT_AND_NOT_CONFIGURED_IN_VERCEL

## Final status

Nbeh is not yet ready for client handoff under the current master completion checklist. The application code contains the platform architecture, merchant dashboard, widget, one-agent runtime, prompt governance, QA, RLS migrations, seed tooling, integrations boundary, and security controls, but the mandatory production Supabase gate cannot be verified.

The previously configured project host `mhzkpmjvxpdegiivvbop.supabase.co` does not resolve. Current Vercel Production contains no Supabase URL, publishable key, or service-role variables and runs the explicit demo/local backend. Production therefore cannot yet prove persistent merchant data, Supabase Auth membership, RLS, cross-merchant isolation, or deployed conversation/insight writes.

The local Supabase CLI is not authenticated, no Supabase access token exists in the process/user/machine environment, and the isolated browser session reaches Supabase's sign-in page. Until the intended new Nbeh account is authenticated, organization ownership cannot be verified and Codex will not create a project under an ambiguous or legacy BTKK1 account.

The pre-deployment verification on 2026-08-13 confirmed the same boundary: DNS reported that the configured Supabase name does not exist; `platform:verify` and `supabase:verify` failed before any database assertion; and the then-current `https://www.nbeh.io/api/agent/health` response identified `demo_catalog` without the new backend or abuse-control health fields. Vercel is authenticated to `nbehsolution-2378`, but Production still has no Supabase URL/key variables and no `AGENT_RATE_LIMIT_SECRET`.

Production was updated on 2026-08-14 to deployment `dpl_3jV26wrVjGDfiCGJ812KTBhBikmB` at `https://www.nbeh.io`. The current health contract is live and reports `dataBackend=local`, `persistenceConfigured=true`, and `abuseControlsConfigured=true`; this truthfully confirms the deployed demo runtime while also proving it is not the required Supabase handoff runtime. Founder login with `Founder@nbeh.io` and the requested password passes, the redesigned two-agent Playground passes with a grounded live response, and all Founder demo-store links open `/store`.

During local Founder UI verification, a malformed Windows environment-import command printed the then-current Vercel Blob read/write token into diagnostic output. The ignored temporary export was deleted immediately and no source file contained the value. Before the next deployment, the empty private Blob store was deleted and recreated in the same `iad1` region with the same Production/Preview connections, which rotated the persistent token. The short-lived Vercel OIDC diagnostic token was not reused and was allowed to expire. The security gate is closed; Supabase remains the handoff blocker.

## Product scope completed in code

- Merchant-installable `/widget.js` loader and isolated `/embed/widget` host
- One shared product-page sales assistant with catalog grounding and bounded fallbacks
- Demo, Salla, and Zid catalog provider boundaries plus CSV import fallback
- Merchant/store/product resolution and normalized product context
- Conversations, messages, anonymous visitors, insights, settings, agent configs, prompt versions, guardrails, integrations, jobs, webhooks, audit logs, and QA schema
- Dashboard routes for overview, conversations/detail, insights, products, agent governance, integrations, settings, and audit log
- Prompt draft, validation, QA, publish, compare, rollback, and audit flows
- Founder global prompt/provider/model controls
- Arabic/English behavior, prompt-injection refusal, payment-data protection, unsupported-claim checks, and PII redaction

## Dashboard routes completed

`/dashboard`, `/dashboard/conversations`, `/dashboard/conversations/[id]`, `/dashboard/insights`, `/dashboard/products`, `/dashboard/agent`, `/dashboard/agent/advanced`, `/dashboard/agent/versions`, `/dashboard/agent/playground`, `/dashboard/agent/qa`, `/dashboard/integrations`, `/dashboard/settings`, `/dashboard/audit-log`, and Founder `/dashboard/platform`.

## Supabase status

- Versioned migrations: implemented
- Idempotent seed: implemented
- Generated/manual TypeScript types: implemented
- RLS policies and role functions: implemented; the live verifier now exercises anonymous/no-membership denial, cross-merchant isolation, viewer read-only behavior, admin commerce/settings access, advanced prompt governance, owner access, and immutable audit/membership controls
- Current live platform verification: failed because the configured hostname does not resolve
- Current live RLS verification: failed for the same external reason
- Vercel Supabase variables: missing
- Local Supabase account context: unauthenticated; Nbeh organization ownership not yet verifiable
- Required recovery steps: [SUPABASE_SETUP_REQUIRED.md](./SUPABASE_SETUP_REQUIRED.md)

## Auth and roles

Supabase Auth membership and owner/admin/advanced_admin/viewer authorization are implemented and tested at the code boundary. Founder authentication is separately deployed for platform governance. A real merchant owner cannot be re-proven until the replacement Supabase project and Auth UUID are supplied.

## Agent runtime

The production response path uses one general sales agent. In selected Supabase mode it now fails closed unless server credentials, `SUPABASE_AGENT_ENABLED=true`, and trusted request fingerprinting are present; it never reads the local catalog, dashboard, auth identity, prompt, or chat store. It loads durable visitor ownership and bounded conversation history before the model call, applies deterministic safety/output validation, directly writes messages/analytics/insights, and uses an atomic Supabase rate bucket keyed by a server-derived HMAC fingerprint in addition to visitor-scoped limits. Rotating the shopper-controlled visitor reference no longer resets the shared request budget. Rejected requests return HTTP 429/`Retry-After` and do not create conversation artifacts. No raw IP address is stored. The older local-snapshot synchronization path is no longer a production dependency. No multi-agent planner/evaluator orchestration is used in the shopper path.

## Advanced prompt settings and QA

Drafts, versions, validation, QA cases/runs, publish gating, comparisons, rollback, and auditing exist. Prompt publish and rollback now use service-role-only database RPCs that atomically change version/config/guardrail state and create their audit row. Global Founder controls apply the Nbeh baseline prompt and model across merchant agents. Live Supabase persistence of those flows must be reverified after backend recovery.

## Insights

Repeated questions, objections, weak descriptions, unknown answers, evidence links, status workflow, and merchant/product scoping are implemented. Production persistence is blocked by Supabase availability.

## Salla/Zid readiness

Both remain honestly `not_connected`. Provider contracts, OAuth state/callback boundaries, signed webhook placeholders, sync-job models, and CSV fallback are present. External completion still requires provider approval, credentials, official fixtures, sandbox contract tests, and a production token vault.

## Security status

Implemented: server-only service credentials, tenant-scoped reads/writes, RLS policies, prompt secrecy, input/output validation, atomic HMAC-pseudonymized shopper rate limiting, independent Founder login throttling, PII redaction, anonymous visitor references, non-removable guardrails, signed-body webhook tenant routing, idempotent event enqueueing, atomic OAuth state handling, same-origin auth/dashboard mutations, iframe-contained same-origin widget APIs, immutable audit/membership grants, audit events for OAuth/webhook/sync lifecycle, header-only revalidation secrets, and no raw platform-token columns. Production RLS and deployment configuration remain unverified while Supabase is blocked.

## Current QA evidence

- Clean local preview started at `http://127.0.0.1:3000` through the preview manager with explicit local/demo settings and freshly seeded data
- Product-page E2E: 16/16 passed on desktop and mobile
- Agent/embed E2E: 18/18 passed on desktop and mobile
- Dashboard/insights E2E: 8/8 passed on desktop and mobile
- Full local E2E: 42 passed, 2 Supabase-only governance cases skipped
- Route-level integration tests cover OAuth replay rejection, signed-body tenant routing, duplicate webhooks, sanitized/audited sync outcomes, role separation, and Supabase global governance
- Unit tests: 91/91 passed, including fail-closed Supabase runtime/global-governance cases, same-origin auth boundaries, independent Founder throttling, trusted request-fingerprint handling, integration-role separation, and destructive-governance confirmation coverage
- Integration tests: 25/25 passed, including HTTP 429 semantics, durable Supabase visitor/conversation/message/rate-limit behavior, visitor-reference rotation resistance, and platform route boundaries
- Full lint and typecheck: passed
- Production build: passed; 25/25 static pages generated
- Secret scan: passed across 661 commit-candidate files
- Graphify code graph refreshed after code changes
- Landing source remains unchanged at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`
- `pnpm run platform:verify`: blocked by DNS resolution
- `pnpm run supabase:verify`: blocked by DNS resolution
- `pnpm run handoff:check`: fails immediately because the active local configuration still has `NEXT_PUBLIC_DEMO_MODE=true`; later mandatory Supabase/Auth gates therefore cannot run yet
- Historical pre-deployment health probe: HTTP 200 from the older demo-catalog build, which was availability evidence only and not Supabase/persistence evidence
- Current Production deployment: `dpl_3jV26wrVjGDfiCGJ812KTBhBikmB`, Ready and aliased to `https://www.nbeh.io`
- Current Production health probe: HTTP 200 with the new backend/abuse-control fields; it explicitly reports `dataBackend=local` and `catalogProvider=demo_catalog`, so it remains demo evidence rather than Supabase evidence
- Live Founder QA: login 200, Founder role and Global Agent visible, two-agent Playground response passed, and demo-store links opened `/store`
- Live landing SHA-256 matches the supplied `nabih-landing-3.html` byte-for-byte
- Vercel Production variable-name audit: authenticated to the intended Vercel team; required Supabase variables and `AGENT_RATE_LIMIT_SECRET` are absent

Historical green reports are not treated as current acceptance evidence. The Supabase-only governance test remains mandatory and was not converted into local/demo evidence.

## Known limitations and future work

1. Supply a reachable Supabase project and configure it locally and in Vercel.
2. Run migrations and idempotent seed.
3. Create/map the real merchant owner Auth user.
4. Run platform and RLS verification.
5. Verify widget conversation → Supabase messages/insights → authenticated dashboard.
6. Run the full handoff suite and fix any newly exposed issues.
7. Enable Salla/Zid only after external approval and token-vault work.

## Exact recovery and verification commands

```bash
pnpm install --frozen-lockfile
pnpm run supabase:migrate
pnpm run supabase:seed
pnpm run platform:verify
pnpm run supabase:verify
pnpm run db:types
pnpm run qa:agent-config
pnpm run secrets:check
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
pnpm run build
pnpm run handoff:check
```

Deployment requires the production variables listed in [SUPABASE_SETUP_REQUIRED.md](./SUPABASE_SETUP_REQUIRED.md), followed by `vercel deploy --prod`. Do not set `READY_FOR_CLIENT_HANDOFF=true` until the final command succeeds against the active Supabase project.
# Latest demo/UI release — 2026-08-14

- Production deployment: `dpl_2DQHHp3Psu37yTSmJRyeXyAuNfxw`
- Canonical URL: `https://www.nbeh.io`
- Dashboard now supports persistent English and Arabic with complete RTL/LTR behavior.
- The Nbeh agent launcher is restored on the demo-store homepage as well as product pages.
- The Playground no longer exposes a shopper-language selector or helper; reply language is derived from each latest shopper message in both client and server paths.
- Every dashboard route and major control was browser-verified in both languages; Arabic mobile was checked at 390×844.
- Production health returns HTTP 200 with `dataBackend=local`; this remains a demo/UI release, not final Supabase handoff evidence.
- `READY_FOR_CLIENT_HANDOFF=false` remains unchanged until the live Supabase/Auth/RLS gates are completed.

## Product-aware Playground reliability update - 2026-08-14

- The production draft 500 was traced to a backend mismatch, not malformed prompt content: the local/demo deployment attempted an unconditional Supabase service-role write.
- Local/demo governance now persists encrypted prompt versions, active selection, QA runs, and audit evidence in the connected private Vercel Blob store; no Supabase credential is required for this deployment mode.
- The Playground again has a branded product selector, and both Live and Draft agents are grounded in the same chosen product page.
- The exact failure journey now has browser coverage: draft creation, mouse product selection, two-agent comparison, and QA-case persistence all pass.
- Current regression evidence: lint passed, typecheck passed, 28 test files / 129 tests passed, production build passed, secret scan passed, focused Chromium E2E passed, and Graphify was refreshed.
- The supplied landing page remains byte-identical at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- This fixes the production demo/UI workflow. It does not satisfy the separate final Supabase/Auth/RLS handoff gate, so `READY_FOR_CLIENT_HANDOFF=false` remains correct.
- Production deployment `dpl_Gjg4zvVQGF5xj8w9NmhDMLV5yHFW` is live at `https://www.nbeh.io`.
- Live Founder lifecycle verification passed for draft, eight-case QA, publish, archive, rollback, baseline restoration, final Playground draft creation, product selection, two-agent comparison, and durable QA-case saving. Version 1 is active and version 3 remains an unpublished draft.
- The Vercel Blob ETag mismatch found during live QA-case saving was corrected and retested at HTTP 200. Production health is HTTP 200 and the final error-log query returned no errors.

## Arabic dashboard hydration update - 2026-08-14

- The production-only React `#418` mismatch was caused by post-render DOM translation running while nested client components were still hydrating on Arabic hard loads.
- Dashboard translation now occurs through React on both the server and client; no dashboard text is rewritten by a DOM observer.
- Every dashboard page entry point is server-translated, while client-only controls use the same locale context for immediate language switching.
- Regression evidence covers Arabic hard load, RTL shell, Advanced settings, product-aware Playground navigation, clean browser console/page/network behavior, and the existing draft/product/QA workflows.
- Production deployment `dpl_D4NmdzxaV2GqNv83mEKayRJ3Gw8Q` is live at `https://www.nbeh.io`; live reproduction arrays are empty for language toggle, client navigation, and hard navigation.
- Production health is HTTP 200, no Vercel error logs were found, and the landing remains byte-identical at SHA-256 `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`.
- This fixes the dashboard reliability issue without changing the separate `READY_FOR_CLIENT_HANDOFF=false` Supabase/Auth/RLS gate.
