# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three active segments: individual professionals (freelancers, agentes, vendedores independientes), PyMEs (equipos pequeños que quieren tarjetas para su equipo con branding centralizado), and empresas. All three are live market targets today, not a phased roadmap. Each buys a physical NFC card linked to a public digital profile they can edit independently of the card.

## Product Purpose

NexCard sells NFC-linked digital business cards. The purchase flow (catalog → cart → checkout → Mercado Pago) produces a physical card and an editable public profile (`/:slug`) that the user maintains after purchase. Success means a completed sale, a working card-to-profile link, and a profile the owner can keep current without needing a reprint or reissue.

## Positioning

The digital profile is decoupled from the physical card: the card is a link/trigger, not the source of truth. The profile lives and can be edited independently, so identity, contact info, and branding update without depending on or replacing the physical object. This differs from competitors where the card and profile are more tightly bound.

## Operating Context

- Public/commercial surface: coming-soon landing (`/`), commercial landing (`/preview`), catalog, cart, checkout, order confirmation, public profile by slug, review-card redirect (`/r/:slug`), terms/privacy/tracking/opt-out.
- Admin backoffice (internal team use): dashboard, orders, inventory, cards, profiles, CRM, NexReview, emails, review cards, products, team, wheel, print test.
- Order lifecycle: catalog → cart → checkout → `create_order_with_items` RPC → Mercado Pago → confirmation → card production/fulfillment → card-to-order linking → shipping/tracking → delivery.
- Backend: Supabase (Auth, Postgres, RLS, RPCs, Edge Functions) is the production source of truth; a local Express server supports dev/fallback/E2E only.
- External services the product depends on: Mercado Pago (payments), Resend (transactional email), Vercel (hosting).

## Capabilities and Constraints

- Admin access is enforced server-side via a `has_role('admin')` RPC against a real `memberships`/roles model in Postgres (`src/utils/adminAccess.js`, `supabase/migrations/202604080001_memberships_baseline.sql` and later hardening migrations) — the frontend email whitelist was removed; `src/config/admin.js` explicitly forbids reintroducing it. Fixed as of 2026-08-21 verification.
- `src/services/api.js` (508 lines as of 2026-08-21) has been partially split into `src/services/api/*` (orders, profiles, cards, inventory, products, crm, payments, emails, kpiAdmin, reviewCards, wheel, orderOperations, adminDashboard) — the monolith-coupling risk noted previously is reduced but not eliminated; confirm current line count/module boundaries before treating this as fully resolved.
- `src/App.jsx` (295 lines as of 2026-08-21) concentrates session bootstrap, admin guards, routing, and checkout flow.
- Known schema drift risk between frontend and Supabase (e.g. `card_scans` tracking was disabled due to schema misalignment).
- E2E (Cypress) suite exists but is not confirmed green in all environments; requires `CYPRESS_login_email` / `CYPRESS_login_password` and other env vars.

## Brand Commitments

None explicitly confirmed yet as binding (no locked palette, typography, or identity system recorded). Existing implementation is incumbent visual evidence, not a confirmed brand system — see DESIGN.md when documented.

## Evidence on Hand

No confirmed customer testimonials, case studies, or press to reference. Do not fabricate. Real, code-verified evidence: working Supabase integration, working Mercado Pago checkout flow, working build (`npm run build` succeeds as of last verified snapshot).

## Product Principles

1. Separate commercial (landing/checkout) from operational (admin) concerns — do not mix their logic or their design priority.
2. The physical card is a trigger, not the source of truth — the digital profile must always be editable independently of the card.
3. Every segment (individual, pyme, empresa) is a live buyer today — do not design as if only one segment matters.
4. Public and admin surfaces receive equal design care — the backoffice is not a lower-priority afterthought.
5. Payment and order integrity (Mercado Pago, RLS, order/payment/refund traceability) is higher priority than new visual features.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet.
