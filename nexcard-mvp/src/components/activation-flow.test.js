import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const activationPagePath = path.join(repoRoot, 'src/components/ActivationPage.jsx');
const appPath = path.join(repoRoot, 'src/App.jsx');
const authPagePath = path.join(repoRoot, 'src/components/AuthPage.jsx');
const appRouteRendererPath = path.join(repoRoot, 'src/components/AppRouteRenderer.jsx');
const apiPath = path.join(repoRoot, 'src/services/api.js');

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
    expect(source).toContain('setPendingClaimToken(null)');
  });

  it('guarda token y email comprador para el primer acceso contextual', () => {
    const appSource = read(appPath);
    const apiSource = read(apiPath);
    const routeSource = read(appRouteRendererPath);

    expect(apiSource).toContain('nexcard_pending_claim_email');
    expect(apiSource).toContain('export const getPendingClaimEmail');
    expect(apiSource).toContain('export const setPendingClaimEmail');
    expect(apiSource).toContain('setPendingClaimEmail(null)');
    expect(appSource).toContain("const handleClaimAuthRequired = (token, buyerEmail = '')");
    expect(appSource).toContain('setPendingClaimEmail(buyerEmail)');
    expect(appSource).toContain("navigate('/login?mode=register&claim=1')");
    expect(routeSource).toContain('pendingClaimEmail={pendingClaimEmail}');
  });

  it('presenta creación de acceso contextual en vez de login genérico', () => {
    const activationSource = read(activationPagePath);
    const authSource = read(authPagePath);

    expect(activationSource).toContain('Crear acceso y activar NexCard');
    expect(activationSource).toContain('Crearás tu acceso NexCard para administrar tu perfil digital');
    expect(activationSource).toContain("onAuthRequired?.(token, buyerEmail)");
    expect(authSource).toContain('Crea tu acceso NexCard.');
    expect(authSource).toContain('Define tu contraseña para activar la NexCard asociada a este correo.');
    expect(authSource).toContain('Crear cuenta y activar NexCard');
    expect(authSource).toContain('readOnly={shouldLockEmail}');
    expect(authSource).toContain('mode === AUTH_MODES.REGISTER && hasPendingClaim');
  });

  it('reclama automáticamente después de auth y conserva fallback seguro', () => {
    const appSource = read(appPath);

    expect(appSource).toContain('const result = await api.claimProfile(claimToken)');
    expect(appSource).toContain('handleContinueSetup({');
    expect(appSource).toContain("navigate(`/activar/${claimToken}`)");
    expect(appSource).toContain("navigate('/edit')");
  });

  it('maneja cuentas creadas pero con email sin confirmar sin perder el contexto de activación', () => {
    const authSource = read(authPagePath);
    const apiSource = read(apiPath);

    expect(authSource).toContain('EMAIL_NOT_CONFIRMED_MESSAGE');
    expect(authSource).toContain('Falta confirmar tu correo antes de ingresar.');
    expect(authSource).toContain('Reenviar correo de confirmación');
    expect(authSource).toContain('buildSignupConfirmationRedirectTo');
    expect(authSource).toContain('/login?mode=login&claim=1');
    expect(authSource).toContain('setConfirmationPending(true)');
    expect(authSource).not.toContain('switchMode(AUTH_MODES.LOGIN);\n        setNotice(\'Cuenta creada.');
    expect(apiSource).toContain('resendSignupConfirmation');
    expect(apiSource).toContain("type: 'signup'");
  });
});
