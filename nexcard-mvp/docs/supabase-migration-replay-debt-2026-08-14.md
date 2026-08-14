# Supabase migration replay debt — 2026-08-14

## Context

While implementing `supabase/migrations/202604080001_memberships_baseline.sql`, a clean local replay was tested with:

```bash
supabase stop --no-backup || true
supabase start
```

Evidence path on execution machine:

- `/tmp/nexcard-memberships-baseline-evidence-20260814173048/supabase-start.log`

## Result

The new memberships baseline fixed the original replay blocker:

```text
Applying migration 202604080001_memberships_baseline.sql...
Applying migration 202604090001_b2_rls_profiles_orders.sql...
NOTICE: relation "memberships_user_id_idx" already exists, skipping
NOTICE: relation "memberships_role_idx" already exists, skipping
NOTICE: relation "memberships_org_idx" already exists, skipping
```

The replay no longer fails on:

```text
relation "public.memberships" does not exist
```

## New blocker surfaced

The next historical replay blocker is `public.profiles` missing when `202604090001_b2_rls_profiles_orders.sql` tries to drop/create policies on it:

```text
ERROR: relation "public.profiles" does not exist (SQLSTATE 42P01)
At statement: 12
-- Remove broad legacy policies before replacing them.
drop policy if exists "profiles_owner_manage" on public.profiles
```

## Interpretation

This confirms that the migration history has more than one baseline gap. The memberships migration is still useful and scoped: it resolves the first known blocker without changing production. A separate baseline/backfill task is needed for the broader initial public schema (`profiles`, and likely other tables assumed by early RLS migrations).

## Follow-up recommendation

Create a separate plan/PR for an initial schema baseline from the production schema dump, or split it into table-family baselines (`profiles`, `organizations`, `orders`, etc.) before the early RLS migrations.
