# Dashboard Sprint Goals

## Outcome

Deliver a merchant-ready Maison Vert dashboard backed by Supabase, with authenticated and merchant-scoped access, durable shopper conversation data, actionable insights, controlled prompt editing, QA-gated publishing, rollback, and a complete audit trail.

## Workstreams

- Supabase foundation: migrations, RLS, typed clients, idempotent seed/reset commands, and explicit backend mode.
- Merchant access: Supabase Auth login/logout, protected dashboard routes, and owner/admin/advanced-admin/viewer permissions.
- Dashboard: overview, conversations, transcript detail, insights, products, agent settings, integrations, settings, and audit log.
- Agent governance: draft prompt versions, safety validation, QA runs, publish gate, comparison, rollback, and immutable active-version references.
- Runtime: load the merchant's active published prompt and guardrails server-side, retain hard-coded safety rules, persist messages and insights, and fall back safely.
- Handoff: unit/integration/E2E coverage, CI, migration/seed verification, live QA, deployment instructions, and updated handoff evidence.

## Acceptance Gate

The sprint is complete only when the schema is live, seed data is present, authenticated merchant scoping is verified, agent governance actions are audited, public shopper routes cannot read private prompts, focused and full test suites pass, the production build passes, and the handoff report records any remaining external integration work.

Salla and Zid remain clearly labeled future connections. No live platform credentials or write-back behavior are included in this sprint.
