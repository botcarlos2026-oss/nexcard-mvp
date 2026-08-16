-- NexCard — Restore public.profiles_public.
-- 202608112350_checkout_attempt_idempotency.sql was recorded as applied (content verified for its
-- other objects: create_order_with_items, reserve_profile_slug_for_order, admin_dispatch_order), but
-- the view it defines does not exist in production right now (confirmed via direct schema dump and
-- PostgREST returning PGRST205 for every slug). Whatever originally applied that migration out-of-band
-- did not leave this view behind. Recreating it idempotently here; this is what broke every public
-- profile page (e.g. https://www.nexcard.cl/kineinsidespa).
begin;

create or replace view public.profiles_public
with (security_barrier = true)
as
select
  id,
  slug,
  full_name,
  profession,
  bio,
  avatar_url,
  theme_color,
  is_dark_mode,
  whatsapp,
  instagram,
  linkedin,
  website,
  vcard_enabled,
  calendar_url,
  account_type,
  company,
  location,
  cover_image_url,
  facebook,
  facebook_enabled,
  instagram_enabled,
  linkedin_enabled,
  contact_email_enabled,
  contact_phone_enabled,
  website_enabled,
  whatsapp_enabled,
  portfolio_enabled,
  portfolio_url,
  calendar_url_enabled,
  tiktok,
  tiktok_enabled,
  review_url,
  card_type,
  status,
  deleted_at
from public.profiles
where coalesce(status, 'active') = 'active'
  and deleted_at is null;

revoke all on public.profiles_public from public;
grant select on public.profiles_public to anon, authenticated;

drop policy if exists "profiles_public_read" on public.profiles;

commit;

notify pgrst, 'reload schema';
