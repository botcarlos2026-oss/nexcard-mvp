import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const migrationPath = path.join(repoRoot, 'supabase/migrations/202607150001_hybrid_order_cards.sql');
const claimProfilePath = path.join(repoRoot, 'supabase/functions/claim-profile/index.ts');

describe('hybrid order cards automation', () => {
  it('defines an idempotent DB function that creates pending-production cards for paid orders', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('create or replace function public.ensure_order_pending_cards');
    expect(sql).toContain("status = 'paid'");
    expect(sql).toContain("'pending_production'");
    expect(sql).toContain('greatest(expected_count - existing_count, 0)');
    expect(sql).toContain('on conflict (order_id, card_id) do nothing');
  });

  it('keeps claimed profiles attached to cards created before activation', () => {
    const source = fs.readFileSync(claimProfilePath, 'utf8');

    expect(source).toContain('ensure_order_pending_cards');
    expect(source).toContain(".eq('order_id', claim.order_id)");
    expect(source).toContain(".is('profile_id', null)");
  });

  it('blocks claim consumption when the logged-in email differs from the buyer email before mutating rows', () => {
    const source = fs.readFileSync(claimProfilePath, 'utf8');

    expect(source).toContain('const normalizeEmail =');
    expect(source).toContain('const claimEmail = normalizeEmail(claim.customer_email);');
    expect(source).toContain('const userEmail = normalizeEmail(user.email);');
    expect(source).toContain('claimEmail && userEmail && claimEmail !== userEmail');
    expect(source).toContain("status: 403");
    expect(source).toContain('Este link pertenece a otro correo comprador');

    const mismatchGuardIndex = source.indexOf('claimEmail && userEmail && claimEmail !== userEmail');
    const claimMutationIndex = source.indexOf('.update(updatePayload)');
    const slugMutationIndex = source.indexOf("status: 'consumed'");
    const cardMutationIndex = source.indexOf("activation_status: 'assigned'");

    expect(mismatchGuardIndex).toBeGreaterThan(-1);
    expect(claimMutationIndex).toBeGreaterThan(mismatchGuardIndex);
    expect(slugMutationIndex).toBeGreaterThan(mismatchGuardIndex);
    expect(cardMutationIndex).toBeGreaterThan(mismatchGuardIndex);
  });
});
