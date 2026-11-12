export const CLAIM_LINK_TTL_DAYS = 14;

type ClaimPreviewSource = {
  customer_email?: string | null;
  quantity?: number | null;
  status?: string | null;
  expires_at?: string | null;
};

type ClaimFinalizationSource = {
  status?: string | null;
  claimed_by_user_id?: string | null;
  claimed_profile_id?: string | null;
};

export const isClaimExpired = (expiresAt?: string | null, nowMs = Date.now()) => {
  if (!expiresAt) return true;
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs;
};

export const hasBearerAuthorization = (authHeader?: string | null) => (
  typeof authHeader === 'string' && authHeader.startsWith('Bearer ') && authHeader.slice(7).trim().length > 0
);

export const getClaimAvailability = (claim: ClaimPreviewSource, nowMs = Date.now()) => {
  if (claim.status === 'claimed') return { httpStatus: 409, reason: 'claimed' as const };
  if (claim.status === 'cancelled') return { httpStatus: 409, reason: 'cancelled' as const };
  if (claim.status === 'expired' || isClaimExpired(claim.expires_at, nowMs)) {
    return { httpStatus: 410, reason: 'expired' as const };
  }
  return { httpStatus: 200, reason: 'available' as const };
};

export const getClaimFinalizationDecision = (
  claim: ClaimFinalizationSource,
  userId?: string | null,
  profileId?: string | null,
) => {
  if (claim.status !== 'claimed') return { httpStatus: 409, reason: 'not_claimed' as const };
  if (!userId || claim.claimed_by_user_id !== userId) return { httpStatus: 403, reason: 'wrong_owner' as const };
  if (!profileId) return { httpStatus: 409, reason: 'profile_required' as const };
  if (claim.claimed_profile_id && claim.claimed_profile_id !== profileId) {
    return { httpStatus: 409, reason: 'profile_conflict' as const };
  }
  return { httpStatus: 200, reason: 'ready' as const };
};

export const maskEmail = (email?: string | null) => {
  const normalized = (email || '').trim().toLowerCase();
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0 || separator === normalized.length - 1) return '***';

  const local = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
};

export const buildPublicClaimPreview = (claim: ClaimPreviewSource) => ({
  claim: {
    status: claim.status || 'pending',
    quantity: Number(claim.quantity) || 1,
    masked_customer_email: maskEmail(claim.customer_email),
    expires_at: claim.expires_at || null,
  },
});
