import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'server/index.js');
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('local server auth hardening', () => {
  it('usa sesiones opacas de alta entropía y rechaza tokens local-<id> construibles', () => {
    const source = read(serverPath);

    expect(source).toContain('const sessions = new Map()');
    expect(source).toContain("randomBytes(32).toString('hex')");
    expect(source).toContain('sessions.set(token');
    expect(source).toContain('getLocalSessionUser(req)');
    expect(source).not.toContain('token: `local-${user.id}`');
    expect(source).not.toContain("replace('local-'");
  });

  it('protege rutas /api/me con usuario verificado y token bearer real', () => {
    const source = read(serverPath);

    expect(source).toContain('async function requireVerifiedUser');
    expect(source).toContain("app.get('/api/me/profile', requireVerifiedUser");
    expect(source).toContain("app.put('/api/me/profile', requireVerifiedUser");
    expect(source).toContain("const allowInsecureLocalAuth = process.env.NEXCARD_ALLOW_INSECURE_LOCAL_AUTH === 'true'");
    expect(source).toContain('const userId = req.verifiedUser.id');
  });

  it('protege rutas admin solo por role explícito o secret local explícito, sin fallback por email', () => {
    const source = read(serverPath);

    expect(source).toContain('async function requireAdmin');
    expect(source).toContain("localUser.role === 'admin'");
    expect(source).toContain("app.get('/api/admin/dashboard', requireAdmin");
    expect(source).toContain("return res.status(403).json({ error: 'Acceso admin requerido' })");
    expect(source).not.toContain('allowInsecureLocalAdmin');
    expect(source).not.toContain('/(^|[.@_-])admin');
  });

  it('limita intentos de login y no guarda password plano nuevo en la sesión', () => {
    const source = read(serverPath);

    expect(source).toContain('const loginLimiter = rateLimit');
    expect(source).toContain("app.post('/api/auth/login', loginLimiter");
    expect(source).toContain('password_hash');
    expect(source).toContain('hashPassword(password)');
    expect(source).toContain('sanitizeStoredUser');
  });

  it('usa allowlist para PUT /api/me/profile y excluye status/view_count', () => {
    const source = read(serverPath);
    const allowedFieldsStart = source.indexOf('const PROFILE_ALLOWED_FIELDS = new Set');
    const allowedFieldsEnd = source.indexOf(']);', allowedFieldsStart);
    const allowedFieldsBlock = source.slice(allowedFieldsStart, allowedFieldsEnd);

    expect(source).toContain('PROFILE_ALLOWED_FIELDS.has(key)');
    expect(allowedFieldsBlock).not.toContain("'status'");
    expect(allowedFieldsBlock).not.toContain("'view_count'");
  });
});
