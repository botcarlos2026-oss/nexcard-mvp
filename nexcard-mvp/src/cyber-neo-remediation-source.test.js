import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Cyber Neo remediation source guards', () => {
  it('Vite define expone solo una whitelist explícita de variables públicas', () => {
    const source = read('vite.config.js');
    expect(source).toContain('CLIENT_ENV_WHITELIST');
    expect(source).toContain("`process.env.${key}`");
    expect(source).not.toContain("'process.env': JSON.stringify(reactAppEnv)");
  });

  it('el cliente local adjunta el token opaco en Authorization', () => {
    const source = read('src/services/api.js');
    expect(source).toContain('storedAuth?.token');
    expect(source).toContain('Authorization: `Bearer ${storedAuth.token}`');
  });

  it('no concede admin por patrón de email en frontend', () => {
    const adminAccess = read('src/utils/adminAccess.js');
    const app = read('src/App.jsx');
    const orders = read('src/services/api/orders.js');

    expect(adminAccess).not.toContain('isAdminEmail');
    expect(adminAccess).not.toContain('email_fallback');
    expect(app).not.toContain('isAdminEmail');
    expect(orders).not.toContain("storedAuth?.user?.role === 'admin'");
    expect(orders).not.toContain('/admin/i.test');
  });

  it('profiles updateMyProfile excluye status/view_count de campos autoeditables', () => {
    const source = read('src/services/api/profiles.js');
    const allowedFieldsStart = source.indexOf('const PROFILE_ALLOWED_FIELDS = [');
    const allowedFieldsEnd = source.indexOf('];', allowedFieldsStart);
    const allowedFieldsBlock = source.slice(allowedFieldsStart, allowedFieldsEnd);

    expect(allowedFieldsBlock).not.toContain("'status'");
    expect(allowedFieldsBlock).not.toContain("'view_count'");
    expect(source).toContain("status: existingProfile?.status || 'active'");
  });

  it('la migración Cyber Neo reemplaza RLS abierto y bloquea profile.status no-admin', () => {
    const migration = read('supabase/migrations/202608132300_cyber_neo_rls_profile_status_hardening.sql');
    expect(migration).toContain('email_log_admin_select');
    expect(migration).toContain('email_unsubscribe_admin_select');
    expect(migration).toContain('abandoned_carts_admin_all');
    expect(migration).toContain('card_scans_admin_select');
    expect(migration).toContain('prevent_profile_status_self_update');
    expect(migration).toContain('set_profile_status');
    expect(migration).not.toContain('using (true)');
  });
});
