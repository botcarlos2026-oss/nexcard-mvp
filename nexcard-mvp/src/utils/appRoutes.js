export function isPublicBypassRoute(path) {
  return path === '/login'
    || path === '/setup'
    || path === '/privacidad'
    || path === '/preview'
    || path === '/terminos'
    || path === '/baja'
    || path.startsWith('/r/')
    || path.startsWith('/seguimiento/')
    || path.startsWith('/confirmar/')
    || path.startsWith('/activar/');
}
