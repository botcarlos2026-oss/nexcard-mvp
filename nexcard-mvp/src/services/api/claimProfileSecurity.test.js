import fs from 'node:fs';
import path from 'node:path';
import {
  buildPublicClaimPreview,
  getClaimAvailability,
  getClaimFinalizationDecision,
  hasBearerAuthorization,
  isClaimExpired,
  maskEmail,
} from '../../../supabase/functions/claim-profile/security.ts';

const root = path.resolve(__dirname, '../../..');
const claimSource = fs.readFileSync(path.join(root, 'supabase/functions/claim-profile/index.ts'), 'utf8');
const webhookSource = fs.readFileSync(path.join(root, 'supabase/functions/mp-webhook/index.ts'), 'utf8');
const activationEmailSource = fs.readFileSync(path.join(root, 'supabase/functions/send-profile-activation/index.ts'), 'utf8');
const migrationSource = fs.readFileSync(path.join(root, 'supabase/migrations/202611112318_harden_profile_claim_expiry.sql'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

describe('P1-02 activation bearer-link hardening', () => {
  it('builds an exact minimal preview and masks the buyer email', () => {
    const preview = buildPublicClaimPreview({
      customer_email: 'Carlos.Secret@example.com',
      quantity: 3,
      status: 'pending',
      expires_at: '2026-11-25T00:00:00.000Z',
      order_id: 'must-not-leak',
    });

    expect(preview).toEqual({
      claim: {
        status: 'pending',
        quantity: 3,
        masked_customer_email: 'c***@example.com',
        expires_at: '2026-11-25T00:00:00.000Z',
      },
    });
    expect(JSON.stringify(preview)).not.toContain('Carlos.Secret');
    expect(JSON.stringify(preview)).not.toContain('order_id');
  });

  it('fails closed for missing, invalid and elapsed expiry values', () => {
    const now = Date.parse('2026-11-11T12:00:00.000Z');
    expect(isClaimExpired(null, now)).toBe(true);
    expect(isClaimExpired('not-a-date', now)).toBe(true);
    expect(isClaimExpired('2026-11-11T11:59:59.000Z', now)).toBe(true);
    expect(isClaimExpired('2026-11-11T12:00:01.000Z', now)).toBe(false);
    expect(maskEmail('x@example.com')).toBe('x***@example.com');
  });

  it('maps unauthenticated, expired and claimed states to 401/410/409 contracts', () => {
    const now = Date.parse('2026-11-11T12:00:00.000Z');
    expect(hasBearerAuthorization('')).toBe(false);
    expect(hasBearerAuthorization('Bearer ')).toBe(false);
    expect(hasBearerAuthorization('Bearer valid-jwt')).toBe(true);
    expect(getClaimAvailability({ status: 'pending', expires_at: '2026-11-11T11:59:59.000Z' }, now)).toEqual({
      httpStatus: 410,
      reason: 'expired',
    });
    expect(getClaimAvailability({ status: 'claimed', expires_at: '2026-11-25T00:00:00.000Z' }, now)).toEqual({
      httpStatus: 409,
      reason: 'claimed',
    });
    expect(claimSource).toContain('status: 401');
  });

  it('permite finalizar el vínculo solo al dueño autenticado y su perfil', () => {
    const claim = {
      status: 'claimed',
      claimed_by_user_id: 'user-1',
      claimed_profile_id: null,
    };
    expect(getClaimFinalizationDecision(claim, 'user-1', 'profile-1')).toEqual({
      httpStatus: 200,
      reason: 'ready',
    });
    expect(getClaimFinalizationDecision(claim, 'user-2', 'profile-1')).toEqual({
      httpStatus: 403,
      reason: 'wrong_owner',
    });
    expect(getClaimFinalizationDecision(claim, 'user-1', null)).toEqual({
      httpStatus: 409,
      reason: 'profile_required',
    });
    expect(getClaimFinalizationDecision({ ...claim, claimed_profile_id: 'profile-2' }, 'user-1', 'profile-1')).toEqual({
      httpStatus: 409,
      reason: 'profile_conflict',
    });
  });

  it('checks expiry/status before preview and loads order data only after auth', () => {
    const previewIndex = claimSource.indexOf("if (action === 'preview')");
    const authIndex = claimSource.indexOf('if (!hasBearerAuthorization(authHeader))', previewIndex);
    const orderIndex = claimSource.indexOf(".from('orders')");
    expect(previewIndex).toBeGreaterThan(0);
    expect(authIndex).toBeGreaterThan(previewIndex);
    expect(orderIndex).toBeGreaterThan(authIndex);
    expect(claimSource).toContain("status: 401");
    expect(claimSource).toContain("claim_token: crypto.randomUUID().replaceAll('-', '')");
    expect(claimSource).toContain(".gt('expires_at', new Date().toISOString())");
    expect(claimSource).toContain("if (action === 'finalize')");
    expect(claimSource).toContain(".eq('claimed_by_user_id', finalizeUser.id)");
    expect(claimSource).toContain("latestAvailability.reason === 'expired'");
  });

  it('requires expiry at schema and every activation-email creation/send path', () => {
    expect(migrationSource).toContain("alter column expires_at set default (now() + interval '14 days')");
    expect(migrationSource).toContain('alter column expires_at set not null');
    expect(migrationSource).toContain("where status <> 'pending'");
    expect(migrationSource).toContain('pc.claimed_by_user_id = p.user_id');
    expect(webhookSource).toContain('expires_at: expiresAt');
    expect(activationEmailSource).toContain("status: 410");
    expect(activationEmailSource).toContain(".update({ status: 'expired' })");
  });

  it('sets no-referrer and no-store specifically on activation URLs', () => {
    const activationHeaders = vercelConfig.headers.find((entry) => entry.source === '/activar/(.*)');
    expect(activationHeaders).toBeTruthy();
    expect(activationHeaders.headers).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
    expect(activationHeaders.headers).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
  });
});
