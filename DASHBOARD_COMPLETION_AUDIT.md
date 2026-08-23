# Dashboard Completion Audit

Status: **LOCALLY VERIFIED; PRODUCTION SUPABASE VERIFICATION BLOCKED**  
Audited: 2026-08-13

The Nbeh dashboard implementation is present and its current local/demo browser suite passes. It must not be called client-ready while the production Supabase project is unreachable and absent from Vercel.

## Implemented

- Protected routes, Founder and merchant role boundaries, merchant-scoped loaders, and viewer/advanced/admin permissions.
- Overview KPIs; conversation filtering/detail/review; insights workflow; product completeness; integrations; settings; audit log.
- Active agent summary, advanced prompt editor, version history, comparison, QA, publish/rollback/archive actions, and playground.
- Custom branded Nbeh dropdowns across dashboard filters and model/provider controls.
- Audit writes and explicit merchant filters on sensitive mutations.

## Current evidence

- Dashboard/insights focused E2E: 8/8 passed on desktop/mobile.
- Full local E2E: 42 passed and 2 Supabase-only governance cases skipped.
- Governance E2E is updated to exercise the custom dropdown and must be rerun against the replacement Supabase environment.
- Dashboard analytics now maps the durable `product_slug`, `visitor_ref`, and `storefront_locale` columns.
- Supabase-selected auth and dashboard loading fail closed instead of granting a demo identity or returning local JSON.
- Publish, rollback, and archive now require explicit browser confirmation before their server actions run.
- Lint, typecheck, 86 unit tests, 22 integration tests, and the 25-page production build pass.
- Commerce integration ownership is restricted to owner/admin, advanced_admin remains prompt-governance focused, and viewers can read integration status without mutation controls.
- Founder login, logout, playground mutations, OAuth start, and catalog sync enforce same-origin requests.

## Blocker

Production dashboard data, Supabase Auth membership, RLS, prompt persistence, and widget-to-dashboard propagation cannot be proven because the prior Supabase hostname does not resolve and Vercel Production is missing the required Supabase variables.

See [SUPABASE_SETUP_REQUIRED.md](./SUPABASE_SETUP_REQUIRED.md) and [HANDOFF_REPORT.md](./HANDOFF_REPORT.md). Do not revive historical `PASS` or `client-handoff ready` claims without completing the live gate.
