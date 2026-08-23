# Project Goals

The canonical product identity and acceptance criteria are maintained in [PRODUCT_SOLUTION_GOALS.md](./PRODUCT_SOLUTION_GOALS.md).

## Master goal

Complete Nbeh as the merchant-agnostic AI Sales Agent platform for Salla and Zid. Maison Vert and the inherited Bagisto storefront are only the demo merchant and QA sandbox.

## Authoritative workspace

- App root: `E:\Saleh`s AI\Nbeh AI`
- Package manager: pnpm 11.7.0
- Framework: Next.js App Router
- Production persistence: Supabase with RLS
- AI runtime: one grounded product-page sales assistant through OpenRouter/DeepSeek routes

## Product scope

- Embeddable product-page widget
- Merchant/store/product-scoped agent runtime
- Supabase persistence, Auth membership, roles, and audit trail
- Merchant dashboard, insights, products, integrations, and settings
- Prompt drafts, QA, publish, version comparison, and rollback
- Non-removable guardrails and safe fallbacks
- Demo Catalog plus Salla/Zid provider boundaries and CSV fallback

## Current external dependencies

- A reachable production Supabase project and keys
- A mapped real merchant owner Auth UUID
- Salla/Zid approval, credentials, official fixtures, and token-vault integration before either provider can be connected

Client handoff readiness must be determined by the current `pnpm run handoff:check` result, never by historical reports.
