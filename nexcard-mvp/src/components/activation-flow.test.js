import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../..');
const activationPagePath = path.join(repoRoot, 'src/components/ActivationPage.jsx');
const appPath = path.join(repoRoot, 'src/App.jsx');
const authPagePath = path.join(repoRoot, 'src/components/AuthPage.jsx');
const appRouteRendererPath = path.join(repoRoot, 'src/components/AppRouteRenderer.jsx');
const setupWizardPath = path.join(repoRoot, 'src/components/SetupWizard.jsx');
const apiPath = path.join(repoRoot, 'src/services/api.js');
const claimFunctionPath = path.join(repoRoot, 'supabase/functions/claim-profile/index.ts');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('activation flow hardening', () => {
  it('redirige a auth solo cuando claimProfile devuelve sesión inválida o expirada', () => {
    const source = read(activationPagePath);

    expect(source).toContain("err?.code === 'AUTH_REQUIRED'");
    expect(source).toContain('onAuthRequired?.(token)');
    expect(source).toContain('err?.status === 401');
    expect(source).not.toContain('err?.status === 401 || err?.status === 403');
  });

  it('muestra mismatch de correo sin volver a la misma activación', () => {
    const source = read(activationPagePath);

    expect(source).toContain('Ingresa con el correo de la compra');
    expect(source).toContain("setError(err?.message || activationHelpMessage)");
  });

  it('preserva y muestra reserved_slug para setup antes de navegar', () => {
    const source = read(activationPagePath);

    expect(source).toContain('const suggestedSlug = user ? claimData?.reserved_slug || order?.card_customization?.desired_slug ||');
    expect(source).toContain('data-cy="activation-suggested-slug"');
    expect(source).toContain('Usuario sugerido listo');
    expect(source).toContain('nexcard.cl/{suggestedSlug}');
    expect(source).toContain("onContinueSetup?.({ reservedSlug: result.reserved_slug || result.order?.card_customization?.desired_slug || '', claimResult: result })");
  });

  it('cierra el ciclo con claim_id autenticado sin reutilizar el bearer URL', () => {
    const source = read(appPath);

    expect(source).toContain("sessionStorage.setItem('nx_pending_claim_id', claimId)");
    expect(source).toContain('await api.finalizeProfileClaim(pendingClaimId)');
    expect(source).toContain("sessionStorage.setItem('nx_pending_profile_slug', reservedSlug)");
    expect(source).toContain("sessionStorage.removeItem('nx_pending_claim_id')");
    expect(source).toContain("sessionStorage.removeItem('nx_pending_profile_slug')");
    expect(source).toContain("sessionStorage.removeItem('nx_pending_profile_seed')");
    expect(source).toContain('setPendingClaimToken(null)');
    expect(read(setupWizardPath)).toContain('await onComplete({ ...formData, slug })');
    expect(read(setupWizardPath)).toContain('No pudimos terminar de vincular tu NexCard');
  });

  it('no devuelve ni loguea el token de activación en el preview del claim', () => {
    const source = read(claimFunctionPath);

    expect(source).not.toContain('token,');
    expect(source).not.toContain("{ token, error");
    expect(source).not.toContain('token_prefix');
    expect(source).not.toContain('token.slice');
    expect(source).toContain('buildPublicClaimPreview(claim)');
  });

  it('prellena setup con datos de la compra para reducir fricción', () => {
    const appSource = read(appPath);
    const setupSource = read(setupWizardPath);

    expect(appSource).toContain('const getProfileSeedFromClaimResult = (result = {}) =>');
    expect(appSource).toContain('order.customer_phone');
    expect(read(claimFunctionPath)).toContain('customer_phone');
    expect(appSource).toContain("sessionStorage.setItem('nx_pending_profile_seed'");
    expect(setupSource).toContain("sessionStorage.getItem('nx_pending_profile_seed')");
    expect(setupSource).toContain('company: profileSeed.company ||');
    expect(setupSource).toContain('whatsapp: profileSeed.whatsapp ||');
    expect(setupSource).toContain('contact_phone: profileSeed.contact_phone || profileSeed.whatsapp ||');
    expect(setupSource).toContain('data-cy="wizard-company"');
    expect(setupSource).toContain('Empresa prellenada desde tu compra');
    expect(setupSource).toContain('Número prellenado desde tu compra');
  });

  it('resalta la vista previa como acción secundaria importante del editor', () => {
    const editorSource = read(path.join(repoRoot, 'src/components/UserEditor.jsx'));

    expect(editorSource).toContain('bg-emerald-50 px-6 py-4 text-emerald-700');
    expect(editorSource).toContain('Ver vista previa de mi NexCard');
    expect(editorSource).toContain('group-hover:translate-x-1');
  });

  it('guarda solo el token antes de enviar al login contextual', () => {
    const apiSource = read(apiPath);
    const appSource = read(appPath);
    const routeSource = read(appRouteRendererPath);

    expect(apiSource).not.toContain('nexcard_pending_claim_email');
    expect(appSource).toContain('const handleClaimAuthRequired = (token)');
    expect(appSource).not.toContain('setPendingClaimEmail');
    expect(appSource).toContain("navigate('/login?mode=register&claim=1')");
    expect(routeSource).not.toContain('pendingClaimEmail');
  });

  it('presenta creación de acceso contextual en vez de login genérico', () => {
    const activationSource = read(activationPagePath);
    const authSource = read(authPagePath);

    expect(activationSource).toContain('Crear acceso y activar NexCard');
    expect(activationSource).toContain('Crearás tu acceso NexCard para administrar tu perfil digital');
    expect(activationSource).toContain('onAuthRequired?.(token)');
    expect(authSource).toContain('Paso 1 de 2: crea tu acceso.');
    expect(authSource).toContain('Después de confirmar tu correo, continuaremos automáticamente al setup guiado.');
    expect(authSource).toContain('Crear acceso y seguir al setup');
    expect(authSource).toContain('Este flujo separa crear acceso de editar perfil');
    expect(authSource).not.toContain('lockedClaimEmail');
    expect(authSource).not.toContain('readOnly={shouldLockEmail}');
    expect(authSource).toContain('mode === AUTH_MODES.REGISTER && hasPendingClaim');
  });

  it('reclama automáticamente después de auth y conserva fallback seguro', () => {
    const appSource = read(appPath);

    expect(appSource).toContain('const completePendingClaim = useCallback(async (claimToken) =>');
    expect(appSource).toContain("path !== '/login'");
    expect(appSource).toContain('pendingClaimCompletionRef.current === pendingClaimToken');
    expect(appSource).toContain('const result = await api.claimProfile(claimToken)');
    expect(appSource).toContain('handleContinueSetup({');
    expect(appSource).toContain("navigate(`/activar/${claimToken}`)");
    expect(appSource).toContain("navigate('/edit')");
  });

  it('presenta setup como segundo paso separado de edición posterior', () => {
    const setupSource = read(setupWizardPath);
    const routeSource = read(appRouteRendererPath);

    expect(setupSource).toContain('Paso 2 de 2 · Setup guiado');
    expect(setupSource).toContain('Ya creaste el acceso. Ahora completa el perfil público');
    expect(setupSource).toContain('data-cy="wizard-reserved-slug-summary"');
    expect(setupSource).toContain('Slug sugerido ya reservado por tu compra/admin');
    expect(routeSource).toContain("if (path === '/setup')");
    expect(routeSource).toContain("if (path === '/edit')");
  });

  it('maneja cuentas creadas pero con email sin confirmar sin perder el contexto de activación', () => {
    const authSource = read(authPagePath);
    const apiSource = read(apiPath);

    expect(authSource).toContain('EMAIL_NOT_CONFIRMED_MESSAGE');
    expect(authSource).toContain('Falta confirmar tu correo antes de ingresar.');
    expect(authSource).toContain('Reenviar correo de confirmación');
    const authFlowSource = read(path.join(repoRoot, 'src/utils/authFlow.js'));

    expect(authSource).toContain('buildSignupConfirmationRedirectTo');
    expect(authFlowSource).toContain('/login?mode=${AUTH_MODES.LOGIN}&claim=1');
    expect(authSource).toContain('setConfirmationPending(true)');
    expect(authSource).not.toContain('switchMode(AUTH_MODES.LOGIN);\n        setNotice(\'Cuenta creada.');
    expect(authSource).toContain('redirectTo: isContextualRegister ? buildSignupConfirmationRedirectTo(window.location.href) : undefined');
    expect(apiSource).toContain('const redirectTo = payload.redirectTo ||');
    expect(apiSource).toContain('resendSignupConfirmation');
    expect(apiSource).toContain("type: 'signup'");
  });
});
