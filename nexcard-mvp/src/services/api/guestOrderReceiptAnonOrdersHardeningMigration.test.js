import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const migrationPath = path.join(
  repoRoot,
  'supabase/migrations/202611101117_close_anon_orders_read.sql'
);

describe('guest order receipt anon orders hardening migration', () => {
  it('closes only the legacy guest orders-read policy and anon table grant', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const normalizedSql = sql.replace(/\s+/g, ' ').toLowerCase();

    expect(normalizedSql).toMatch(/^begin;/);
    expect(normalizedSql).toContain('alter table public.orders enable row level security');
    expect(normalizedSql).toContain(
      'drop policy if exists "allow users to read their own orders" on public.orders'
    );
    expect(normalizedSql).toContain('revoke select on table public.orders from anon');
    expect(normalizedSql).toContain("notify pgrst, 'reload schema'");
    expect(normalizedSql).toMatch(/commit;\s*$/);

    expect(normalizedSql).not.toMatch(/drop policy(?! if exists "allow users to read their own orders")/);
    expect(normalizedSql).not.toMatch(/revoke\s+(?:all|execute).*get_guest_order_receipt/);
    expect(normalizedSql).not.toMatch(/grant\s+.*get_guest_order_receipt/);
  });
});
