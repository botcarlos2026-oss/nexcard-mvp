begin;

-- Every activation bearer link has a finite lifetime. Existing null expiries are
-- derived from creation time, so old links do not receive a fresh 14-day window.
update public.profile_claims
set expires_at = created_at + interval '14 days'
where expires_at is null;

-- Repair historical two-step activations before rotating consumed credentials.
-- Only the already-authenticated owner relation is used; ambiguous/missing profiles
-- remain visible to the pre-deploy audit instead of being guessed.
update public.profile_claims pc
set claimed_profile_id = p.id,
    updated_at = now()
from public.profiles p
where pc.status = 'claimed'
  and pc.claimed_profile_id is null
  and pc.claimed_by_user_id = p.user_id
  and p.deleted_at is null;

-- Retire already-expired pending links and rotate every non-pending credential.
-- This invalidates leaked historical URLs without deleting audit rows.
update public.profile_claims
set status = 'expired',
    updated_at = now()
where status = 'pending'
  and expires_at <= now();

update public.profile_claims
set claim_token = replace(gen_random_uuid()::text, '-', ''),
    updated_at = now()
where status <> 'pending';

alter table public.profile_claims
  alter column expires_at set default (now() + interval '14 days'),
  alter column expires_at set not null;

commit;
