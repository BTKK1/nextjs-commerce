# Nbeh AI Sales Agent — Product Solution Goals

## Product identity

Nbeh is a merchant-agnostic AI Sales Agent platform for Salla and Zid stores. The paid product is the embeddable product-page sales widget, one grounded conversational agent, the Supabase tenant backend, merchant authentication and dashboard, conversation-derived insights, prompt governance, QA, guardrails, integrations, and audit controls.

Maison Vert and the inherited Bagisto storefront are only the current demo merchant and QA sandbox. They are not the final product, platform backend, or merchant administration system. Product code must never depend on Maison Vert-specific names, product IDs, or demo files outside the explicit Demo Catalog adapter and seed fixtures.

## Architecture goals

- Support multiple merchants through explicit `merchant_id` scoping and RLS.
- Resolve every shopper request through merchant, store, and normalized product context.
- Use one general sales assistant whose behavior changes through the active global baseline, merchant prompt version, catalog facts, policies, and conversation history.
- Keep hard safety, grounding, prompt-secrecy, payment-data, and unsupported-claim rules outside editable prompts.
- Persist production data in Supabase. Local JSON exists only for explicit development, CI, and offline demo modes.
- Treat Salla and Zid as unconnected providers until approval, credentials, token-vault storage, and contract tests are available.
- Keep CSV import as the documented onboarding fallback while provider approval is pending.

## Current modes

| Mode | Intended use | Required configuration |
|---|---|---|
| Demo/local | Offline development, deterministic CI, Maison Vert showcase | `DATA_BACKEND=local`, `NEXT_PUBLIC_DEMO_MODE=true` |
| Merchant production | Authenticated merchant dashboard and persistent widget telemetry | `DATA_BACKEND=supabase`, `NEXT_PUBLIC_DEMO_MODE=false`, reachable Supabase URL and keys |
| Founder demo owner | Platform-wide prompt/model governance plus Maison Vert merchant access | Founder session credentials and a production persistence backend |

Production readiness cannot be claimed from local mode. The Supabase migration, seed, RLS verification, merchant membership, widget persistence, and deployed environment must all pass against the active production project.

## Integration status

- Demo Catalog: connected only for showcase and QA.
- Salla: adapter/readiness endpoints scaffolded; not connected.
- Zid: adapter/readiness endpoints scaffolded; not connected.
- CSV: normalized import path implemented for approval-delay onboarding.

## Completion gate

The project is ready only when `pnpm run handoff:check` passes with a reachable Supabase backend, authenticated merchant coverage, unit/integration/E2E checks, agent quality checks, security checks, and a production build. `HANDOFF_REPORT.md` must reflect the current run rather than historical evidence.
