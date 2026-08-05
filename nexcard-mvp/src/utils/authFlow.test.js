import {
  AUTH_MODES,
  buildPasswordResetRedirectTo,
  buildSignupConfirmationRedirectTo,
  getInitialAuthMode,
  normalizeAuthEmail,
  validatePasswordResetForm,
} from './authFlow';

describe('authFlow helpers', () => {
  it('opens password update mode from the Supabase recovery redirect query', () => {
    expect(getInitialAuthMode('?mode=reset-password')).toBe(AUTH_MODES.RESET_PASSWORD);
    expect(getInitialAuthMode('?type=recovery')).toBe(AUTH_MODES.RESET_PASSWORD);
  });

  it('opens register mode for first-access claim flows', () => {
    expect(getInitialAuthMode('?mode=register&claim=1')).toBe(AUTH_MODES.REGISTER);
    expect(getInitialAuthMode('?mode=login&claim=1', { hasPendingClaim: true })).toBe(AUTH_MODES.LOGIN);
    expect(getInitialAuthMode('', { hasPendingClaim: true })).toBe(AUTH_MODES.REGISTER);
    expect(getInitialAuthMode('?mode=reset-password', { hasPendingClaim: true })).toBe(AUTH_MODES.RESET_PASSWORD);
  });

  it('normalizes reset email before requesting the recovery email', () => {
    expect(normalizeAuthEmail('  Cliente@NexCard.CL  ')).toBe('cliente@nexcard.cl');
  });

  it('builds a stable login recovery redirect URL', () => {
    expect(buildPasswordResetRedirectTo('https://www.nexcard.cl/preview')).toBe('https://www.nexcard.cl/login?mode=reset-password');
    expect(buildPasswordResetRedirectTo('https://www.nexcard.cl')).toBe('https://www.nexcard.cl/login?mode=reset-password');
  });

  it('builds a claim-preserving signup confirmation redirect URL', () => {
    expect(buildSignupConfirmationRedirectTo('https://www.nexcard.cl/activar/claim-token')).toBe('https://www.nexcard.cl/login?mode=login&claim=1');
    expect(buildSignupConfirmationRedirectTo('https://www.nexcard.cl')).toBe('https://www.nexcard.cl/login?mode=login&claim=1');
  });

  it('requires a strong matching password for recovery update', () => {
    expect(validatePasswordResetForm('1234567', '1234567')).toEqual('La contraseña debe tener al menos 8 caracteres.');
    expect(validatePasswordResetForm('12345678', '87654321')).toEqual('Las contraseñas no coinciden.');
    expect(validatePasswordResetForm('12345678', '12345678')).toBeNull();
  });
});
