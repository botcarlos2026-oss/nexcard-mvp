import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server/index.js'), 'utf8');

describe('local server auth guardrails', () => {
  it('no usa x-user-id como identidad directa para /api/me/profile', () => {
    expect(source).not.toContain("const userId = req.header('x-user-id')");
    expect(source).toContain('async function requireVerifiedUser(req, res, next)');
    expect(source).toContain("if (allowInsecureLocalAuth && req.header('x-user-id'))");
    expect(source).toContain("app.get('/api/me/profile', requireVerifiedUser");
    expect(source).toContain('const userId = req.verifiedUser.id');
  });

  it('protege rutas /api/admin con requireAdmin', () => {
    const protectedRoutes = [
      "app.get('/api/admin/dashboard'",
      "app.get('/api/admin/cards'",
      "app.get('/api/admin/inventory'",
      "app.get('/api/admin/orders'",
      "app.post('/api/admin/orders'",
      "app.get('/api/admin/content/landing'",
      "app.put('/api/admin/content/landing'",
    ];

    for (const route of protectedRoutes) {
      const idx = source.indexOf(route);
      expect(idx).toBeGreaterThan(-1);
      expect(source.slice(idx, idx + 180)).toContain('requireAdmin');
    }
  });
});
