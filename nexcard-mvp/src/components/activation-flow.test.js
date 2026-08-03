import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const activationPagePath = path.join(repoRoot, 'src/components/ActivationPage.jsx');
const appPath = path.join(repoRoot, 'src/App.jsx');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('activation flow hardening', () => {
  it('redirige a auth cuando claimProfile devuelve sesión inválida o expirada', () => {
    const source = read(activationPagePath);

    expect(source).toContain("err?.code === 'AUTH_REQUIRED'");
    expect(source).toContain('onAuthRequired?.(token)');
    expect(source).toContain("err?.status === 401 || err?.status === 403");
  });

  it('preserva reserved_slug para setup antes de navegar', () => {
    const source = read(activationPagePath);

    expect(source).toContain("onContinueSetup?.({ token, reservedSlug: result.reserved_slug || result.order?.card_customization?.desired_slug || '' })");
  });

  it('cierra el ciclo del reserved_slug después de completar setup y claim', () => {
    const source = read(appPath);

    expect(source).toContain("sessionStorage.setItem('nx_pending_profile_slug', reservedSlug)");
    expect(source).toContain("sessionStorage.removeItem('nx_pending_profile_slug')");
    expect(source).toContain("setPendingClaimToken(null)");
  });
});
