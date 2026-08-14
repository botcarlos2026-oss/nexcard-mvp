# public.memberships production schema baseline — 2026-08-14

This document captures the real production schema for `public.memberships` using read-only schema queries. No credentials or row data are included.

Production project: `ghiremuuyprohdqfrxsy`
Source command shape:

```bash
supabase db query --linked -f /tmp/memberships_schema_probe.sql
```

## Captured output

```text
section     | item                                    | detail
------------+-----------------------------------------+-------------------------------------------------------------------------------------------------------------------------
columns     | 1                                       | id | uuid | uuid | nullable=NO | default=uuid_generate_v4()
columns     | 2                                       | user_id | uuid | uuid | nullable=NO | default=NULL
columns     | 3                                       | organization_id | uuid | uuid | nullable=NO | default=NULL
columns     | 4                                       | role | text | text | nullable=NO | default=NULL
columns     | 5                                       | created_at | timestamp with time zone | timestamptz | nullable=NO | default=now()
columns     | 6                                       | deleted_at | timestamp with time zone | timestamptz | nullable=YES | default=NULL
constraints | memberships_organization_id_fkey        | f | FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
constraints | memberships_pkey                        | p | PRIMARY KEY (id)
constraints | memberships_role_check                  | c | CHECK ((role = ANY (ARRAY['admin'::text, 'company_owner'::text, 'company_member'::text])))
constraints | memberships_user_id_fkey                | f | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
constraints | memberships_user_id_organization_id_key | u | UNIQUE (user_id, organization_id)
indexes     | idx_memberships_org_id                  | CREATE INDEX idx_memberships_org_id ON public.memberships USING btree (organization_id)
indexes     | idx_memberships_user_id                 | CREATE INDEX idx_memberships_user_id ON public.memberships USING btree (user_id)
indexes     | memberships_org_idx                     | CREATE INDEX memberships_org_idx ON public.memberships USING btree (organization_id)
indexes     | memberships_pkey                        | CREATE UNIQUE INDEX memberships_pkey ON public.memberships USING btree (id)
indexes     | memberships_role_idx                    | CREATE INDEX memberships_role_idx ON public.memberships USING btree (role)
indexes     | memberships_user_id_idx                 | CREATE INDEX memberships_user_id_idx ON public.memberships USING btree (user_id)
indexes     | memberships_user_id_organization_id_key | CREATE UNIQUE INDEX memberships_user_id_organization_id_key ON public.memberships USING btree (user_id, organization_id)
policies    | mem_admin_manage                        | ALL | roles={authenticated} | qual=has_role('admin'::text) | with_check=has_role('admin'::text)
policies    | mem_select_self                         | SELECT | roles={authenticated} | qual=(user_id = auth.uid()) | with_check=NULL
rls         | memberships                             | rowsecurity=true
row_count   | membership_rows                         | 3
```

## Implementation notes

- The baseline migration must use the production role constraint exactly: `admin`, `company_owner`, `company_member`.
- `organization_id` is `NOT NULL` in production.
- Production has both old and newer index names for `user_id` / `organization_id` (`idx_memberships_*` and `memberships_*_idx`). The baseline keeps these idempotently so production remains no-op and fresh replay can satisfy later migrations.
- The FK to `auth.users(id)` can be created in a clean Supabase local DB because `auth.users` exists during migration replay.
- The FK to `public.organizations(id)` must be guarded in the baseline because current migration history also appears to assume `public.organizations` already exists. The baseline creates `memberships` first and adds `memberships_organization_id_fkey` only when `public.organizations` is present. In production the constraint already exists, so this is a no-op.
- RLS is enabled in the baseline. Policies `mem_select_self` and `mem_admin_manage` are still created by `202604090001_b2_rls_profiles_orders.sql`, which already drops/recreates them.
