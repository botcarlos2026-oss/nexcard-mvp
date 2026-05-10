begin;

-- 1) Membership helpers must ignore soft-deleted rows.
create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.role = required_role
      and m.deleted_at is null
  );
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.organization_id = target_org
      and m.deleted_at is null
  );
$$;

revoke all on function public.has_role(text) from public;
revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.has_role(text) to anon, authenticated;
grant execute on function public.is_org_member(uuid) to anon, authenticated;

-- 2) Tighten broad authenticated-all policies on backoffice tables.

drop policy if exists "refunds_authenticated_all" on public.refunds;
create policy "refunds_admin_all"
on public.refunds for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "crm_contacts_auth" on public.crm_contacts;
create policy "crm_contacts_admin_all"
on public.crm_contacts for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "crm_deals_auth" on public.crm_deals;
create policy "crm_deals_admin_all"
on public.crm_deals for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "crm_activities_auth" on public.crm_activities;
create policy "crm_activities_admin_all"
on public.crm_activities for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "team_members_auth_all" on public.team_members;
create policy "team_members_admin_all"
on public.team_members for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "review_cards_authenticated_all" on public.review_cards;
create policy "review_cards_admin_all"
on public.review_cards for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

commit;
