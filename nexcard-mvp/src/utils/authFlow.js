export const AUTH_MODES = Object.freeze({
  LOGIN: 'login',
  REGISTER: 'register',
  REQUEST_RESET: 'request-reset',
  RESET_PASSWORD: 'reset-password',
});

export function getInitialAuthMode(search = '', options = {}) {
  const params = new URLSearchParams(search || '');
  if (params.get('mode') === AUTH_MODES.RESET_PASSWORD || params.get('type') === 'recovery') {
    return AUTH_MODES.RESET_PASSWORD;
  }
  if (params.get('mode') === AUTH_MODES.LOGIN) {
    return AUTH_MODES.LOGIN;
  }
  if (params.get('mode') === AUTH_MODES.REGISTER || options.hasPendingClaim) {
    return AUTH_MODES.REGISTER;
  }
  return AUTH_MODES.LOGIN;
}

export function normalizeAuthEmail(email = '') {
  return String(email).trim().toLowerCase();
}

export function buildPasswordResetRedirectTo(hrefOrOrigin) {
  const url = new URL(hrefOrOrigin || 'https://www.nexcard.cl');
  return `${url.origin}/login?mode=${AUTH_MODES.RESET_PASSWORD}`;
}

export function buildSignupConfirmationRedirectTo(hrefOrOrigin) {
  const url = new URL(hrefOrOrigin || 'https://www.nexcard.cl');
  return `${url.origin}/login?mode=${AUTH_MODES.LOGIN}&claim=1`;
}

export function parseAuthHashError(hash = '') {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const error = params.get('error');
  const errorCode = params.get('error_code');
  if (!error && !errorCode) return null;
  return { error, errorCode, errorDescription: params.get('error_description') };
}

export function getAuthHashErrorMessage({ errorCode } = {}) {
  if (errorCode === 'otp_expired') {
    return 'Tu link de acceso expiró. Ingresa tu correo y vuelve a intentar o pide uno nuevo.';
  }
  return 'Tu link de acceso no es válido o ya fue usado. Ingresa tu correo y vuelve a intentar o pide uno nuevo.';
}

export function validatePasswordResetForm(password = '', confirmPassword = '') {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}
