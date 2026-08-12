import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'server/index.js');
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('local server auth hardening', () => {
  it('protege rutas /api/me con usuario verificado y no confía x-user-id por defecto', () => {
    const source = read(serverPath);

    expect(source).toContain('async function requireVerifiedUser');
    expect(source).toContain("app.get('/api/me/profile', requireVerifiedUser");
    expect(source).toContain("app.put('/api/me/profile', requireVerifiedUser");
    expect(source).toContain("const allowInsecureLocalAuth = process.env.NEXCARD_ALLOW_INSECURE_LOCAL_AUTH === 'true'");
    expect(source).toContain('const userId = req.verifiedUser.id');
  });

  it('protege rutas admin con requireAdmin y fail-closed por defecto', () => {
    const source = read(serverPath);

    expect(source).toContain('async function requireAdmin');
    expect(source).toContain("app.get('/api/admin/dashboard', requireAdmin");
    expect(source).toContain("app.get('/api/admin/orders', requireAdmin");
    expect(source).toContain("app.put('/api/admin/content/landing', requireAdmin");
    expect(source).toContain("return res.status(403).json({ error: 'Acceso admin requerido' })");
    expect(source).toContain("const allowInsecureLocalAdmin = process.env.NEXCARD_ALLOW_INSECURE_LOCAL_ADMIN === 'true'");
  });
});
