import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/202611092307_fix_guest_order_receipt_amount_type.sql'
);

const receiptColumns = [
  'id uuid',
  'folio text',
  'customer_email text',
  'payment_method text',
  'payment_status text',
  'paid_at timestamptz',
  'fulfillment_status text',
  'amount_cents bigint',
  'currency text',
  'created_at timestamptz',
  'updated_at timestamptz',
];

describe('guest order receipt bigint corrective migration', () => {
  it('replaces the exact RPC signature with a signed bigint receipt projection', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();

    expect(normalizedSql).toMatch(/^begin;/);
    expect(normalizedSql).toContain(
      'drop function if exists public.get_guest_order_receipt(uuid, text, text)'
    );
    expect(normalizedSql).toContain('create function public.get_guest_order_receipt(');

    const returnsTable = normalizedSql.match(/returns table \((.*?)\) language plpgsql/s)?.[1];
    expect(returnsTable?.split(',').map((column) => column.trim())).toEqual(receiptColumns);
    expect(normalizedSql).not.toMatch(/o\.amount_cents\s*::\s*(?:integer|int4)\b/);
  });

  it('preserves the restricted authorization, security and schema-cache controls', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();

    expect(normalizedSql).toContain('security definer');
    expect(normalizedSql).toContain('set search_path = public');
    expect(normalizedSql).toContain('o.id = p_order_id');
    expect(normalizedSql).toContain('o.client_checkout_attempt_id = p_checkout_attempt_id');
    expect(normalizedSql).toContain('o.client_checkout_fingerprint = p_checkout_fingerprint');
    expect(normalizedSql).toContain('o.deleted_at is null');
    expect(normalizedSql).toContain(
      'revoke all on function public.get_guest_order_receipt(uuid, text, text) from public'
    );
    expect(normalizedSql).toContain(
      'grant execute on function public.get_guest_order_receipt(uuid, text, text) to anon, authenticated, service_role'
    );
    expect(normalizedSql).toContain("notify pgrst, 'reload schema'");
    expect(normalizedSql).toMatch(/commit;\s*$/);
  });
});
