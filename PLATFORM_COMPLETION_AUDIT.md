# A-Z Platform Completion Audit

Status: **BLOCKED â€” not ready for client handoff**  
Audited: 2026-08-13

This audit separates implemented code and current local evidence from the mandatory production Supabase evidence. Maison Vert is only the demo merchant and QA catalog; Nbeh is the merchant-installable AI Sales Agent platform for Salla/Zid stores.

## Implemented platform scope

- Merchant-scoped schema, migrations, seed tooling, RLS policies, database types, auth/role guards, and audit logging are present.
- The dashboard includes overview, conversations/detail, insights, products, agent settings, advanced prompt governance, versions, playground, QA, integrations, settings, and audit log.
- The shopper path uses one general grounded agent, bounded history, deterministic guardrails/fallbacks, anonymous visitor ownership, and deterministic insight extraction.
- Widget loader/embed isolation, demo provider, Salla/Zid adapter boundaries, OAuth/webhook placeholders, sync jobs, and CSV fallback exist.
- Public API validation is bounded and unexpected backend/provider errors are not returned to browsers.

## Current local evidence

- Exact landing asset SHA-256: `EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083`
- Focused product E2E: 16/16 passed.
- Focused agent/embed E2E: 18/18 passed.
- Focused dashboard E2E: 8/8 passed.
- Full local E2E: 42 passed, 2 Supabase-only governance cases skipped.
- Unit tests: 91/91 passed; integration tests: 25/25 passed, including trusted request-fingerprint/Founder throttling, HTTP 429 semantics, visitor-reference rotation resistance, and behavioral platform-route/global-governance/integration-audit cases.
- Lint, typecheck, secret scan, and production build pass after public API error hardening.
- Supabase-selected catalog/auth/dashboard/config/chat paths have explicit fail-closed regression coverage; health returns a truthful degraded 503 when persistence is unavailable.
- Prompt publish/rollback state and audit evidence are written by the same service-role-only database transaction.
- OAuth setup/consumption and webhook enqueueing use service-role-only atomic RPCs; webhook tenant routing comes only from signed payload data.
- OAuth/webhook/sync lifecycle events create sanitized durable audit evidence; direct authenticated audit, membership, webhook-event, and OAuth-state mutations are revoked.
- Integration ownership is limited to owner/admin while advanced_admin remains focused on prompt governance; viewer integration status remains read-only.
- Global Founder prompt/model configuration is Supabase-authoritative in production and atomically audited.
- Shopper and Founder abuse limits now use independent atomic Supabase buckets keyed by a Vercel/trusted-proxy-derived HMAC fingerprint; no raw client address is stored, rotating `visitorRef` does not reset the budget, and rejected shopper traffic returns 429 without creating conversation artifacts.

## Blocking production evidence

- The configured Supabase hostname does not resolve.
- Vercel Production has no Supabase URL, publishable key, or service-role variables.
- Current production uses demo/local persistence, so production Auth membership, RLS, tenant isolation, and durable widget-to-dashboard writes are not proven.
- Salla/Zid remain `not_connected`; provider approval, credentials, a production token vault, fixtures, and sandbox testing are external milestones.

## Handoff rule

Do not mark the platform ready until a reachable Supabase project is migrated and seeded, a merchant owner is mapped, platform/RLS/live-governance verification passes, production variables are deployed, widget writes are observed in the authenticated dashboard, and `pnpm run handoff:check` succeeds.

Recovery steps are in [SUPABASE_SETUP_REQUIRED.md](./SUPABASE_SETUP_REQUIRED.md). The authoritative status is [HANDOFF_REPORT.md](./HANDOFF_REPORT.md).
