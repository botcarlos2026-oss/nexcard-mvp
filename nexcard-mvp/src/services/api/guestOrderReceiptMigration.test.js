import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/202611091500_secure_guest_order_receipt.sql'
);
const sql = fs.readFileSync(migrationPath, 'utf8');
const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();

const receiptColumns = [
  'id uuid',
  'folio text',
  'customer_email text',
  'payment_method text',
  'payment_status text',
  'paid_at timestamptz',
  'fulfillment_status text',
  'amount_cents integer',
  'currency text',
  'created_at timestamptz',
  'updated_at timestamptz',
];

describe('guest order receipt migration', () => {
  it('defines the narrow receipt projection and compound guest authorization', () => {
    expect(normalizedSql).toContain('security definer');
    expect(normalizedSql).toContain('set search_path = public');
    expect(normalizedSql).toContain('p_order_id uuid');
    expect(normalizedSql).toContain('p_checkout_attempt_id text');
    expect(normalizedSql).toContain('p_checkout_fingerprint text');
    expect(normalizedSql).toContain('o.id = p_order_id');
    expect(normalizedSql).toContain('o.client_checkout_attempt_id = p_checkout_attempt_id');
    expect(normalizedSql).toContain('o.client_checkout_fingerprint = p_checkout_fingerprint');
    expect(normalizedSql).toContain('o.deleted_at is null');

    const returnsTable = normalizedSql.match(/returns table \((.*?)\) language plpgsql/s)?.[1];
    expect(returnsTable?.split(',').map((column) => column.trim())).toEqual(receiptColumns);
  });

  it('returns no rows for invalid credentials and protects the base orders table', () => {
    expect(normalizedSql).toMatch(
      /if p_order_id is null or nullif\(btrim\(p_checkout_attempt_id\), ''\) is null or nullif\(btrim\(p_checkout_fingerprint\), ''\) is null then return; end if;/
    );
    expect(normalizedSql).not.toMatch(/grant\s+select\s+on\s+(table\s+)?public\.orders\s+to\s+anon/i);
    expect(normalizedSql).not.toContain('customer_phone');
    expect(normalizedSql).not.toContain('customer_address');
    expect(normalizedSql).not.toContain('invoice_rut');
    expect(normalizedSql).not.toContain('client_checkout_fingerprint,');
  });

  it('exposes only RPC execution and reloads the PostgREST schema cache', () => {
    expect(normalizedSql).toContain(
      'revoke all on function public.get_guest_order_receipt(uuid, text, text) from public'
    );
    expect(normalizedSql).toContain(
      'grant execute on function public.get_guest_order_receipt(uuid, text, text) to anon, authenticated, service_role'
    );
    expect(normalizedSql).toContain("notify pgrst, 'reload schema'");
  });
});
