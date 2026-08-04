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

export function validatePasswordResetForm(password = '', confirmPassword = '') {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (password !== confirmPassword) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}
