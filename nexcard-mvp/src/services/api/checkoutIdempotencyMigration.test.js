import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migration = fs.readFileSync(
  path.join(repoRoot, 'supabase/migrations/202608112350_checkout_attempt_idempotency.sql'),
  'utf8'
);

describe('checkout idempotency migration', () => {
  it('persiste prueba de intento y crea índice único activo', () => {
    expect(migration).toContain('add column if not exists client_checkout_attempt_id text');
    expect(migration).toContain('add column if not exists client_checkout_fingerprint text');
    expect(migration).toContain('orders_client_checkout_attempt_active_unique');
    expect(migration).toContain('where deleted_at is null');
  });

  it('expone perfiles públicos por view sin columnas sensibles', () => {
    expect(migration).toContain('drop policy if exists "profiles_public_read" on public.profiles');
    expect(migration).toContain('create view public.profiles_public');
    expect(migration).toContain('grant select on public.profiles_public to anon, authenticated');
    expect(migration).not.toContain('bank_name');
    expect(migration).not.toContain('bank_rut');
    expect(migration).not.toContain('bank_email');
  });

  it('reusa la orden existente solo si el fingerprint coincide', () => {
    expect(migration).toContain('v_checkout_attempt_id text');
    expect(migration).toContain('v_checkout_fingerprint text');
    expect(migration).toContain('v_existing_order.client_checkout_fingerprint is distinct from v_checkout_fingerprint');
    expect(migration).toContain('return v_existing_order.id');
  });

  it('no acepta user_id forjado desde el payload del cliente', () => {
    expect(migration).toContain('auth.uid(),');
    expect(migration).not.toContain("nullif(p_order->>'user_id', '')::uuid");
  });
});
