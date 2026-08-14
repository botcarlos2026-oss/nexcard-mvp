# Post-rollback verification — 202608132300

Source rollback: `docs/rollbacks/202608132300_rollback.sql`
Original prod migration: `supabase/migrations/202608132300_cyber_neo_rls_profile_status_hardening.sql`

Validated on 2026-08-14 in a disposable Postgres 17 container restored from a read-only production schema dump.

This file documents the expected structural state after applying the emergency rollback in a disposable environment. It is not an instruction to run the rollback in production.

## Expected post-rollback structural state

- `save_abandoned_cart_public`, `mark_abandoned_cart_converted_public`, `set_profile_status`, `prevent_profile_status_self_update`: absent
- `trg_prevent_profile_status_self_update`: absent
- `email_log_admin_select`: admin-scoped
- `abandoned_carts_admin_all`: admin-scoped
- `abandoned_carts_anon_insert`: present
- `abandoned_carts_anon_lifecycle_update`: present
- `card_scans_admin_read`: admin-scoped
- `card_scans_admin_manage`: admin-scoped

## Original local evidence path from execution machine

- `/tmp/nexcard-rollback-verify-20260814135703/post-rollback-verification.log`

## Captured verification output

```text
                polname                 | using_expr
----------------------------------------+------------------------------------------------------------------------------------------------------------------
 abandoned_carts_admin_all              | has_role('admin'::text)
 abandoned_carts_anon_insert            |
 abandoned_carts_anon_lifecycle_update  | ((update_token = current_cart_update_token()) AND (status = ANY (ARRAY['abandoned'::text, 'email_sent'::text])))
 card_scans_admin_manage                | has_role('admin'::text)
 card_scans_admin_read                  | has_role('admin'::text)
 card_scans_anon_insert                 |
 card_scans_public_insert               |
 email_log_admin_insert                 |
 email_log_admin_select                 | has_role('admin'::text)
 email_unsubscribe_authenticated_select | true
 email_unsubscribe_public_insert        |
(11 rows)

 proname
---------
(0 rows)

 tgname
--------
(0 rows)
```
