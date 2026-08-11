const { next } = require('@vercel/functions');

const PUBLIC_ROUTE_PREFIXES = [
  '/admin',
  '/api',
  '/assets',
  '/activar',
  '/seguimiento',
  '/confirmar',
  '/r',
];

const PUBLIC_ROUTES = new Set([
  '/',
  '/preview',
  '/coming-soon',
  '/privacidad',
  '/terminos',
  '/login',
  '/baja',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/og-image.svg',
  '/robots.txt',
  '/sitemap.xml',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function isStaticAsset(pathname) {
  return /\.[a-zA-Z0-9]{2,8}$/.test(pathname);
}

function getCandidatePublicSlug(pathname) {
  const normalized = normalizePath(pathname);
  if (PUBLIC_ROUTES.has(normalized)) return null;
  if (PUBLIC_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) return null;
  if (isStaticAsset(normalized)) return null;

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length !== 1) return null;

  const [slug] = parts;
  return SLUG_PATTERN.test(slug) ? slug : null;
}

function getSupabaseConfig(env = process.env) {
  const url = env.REACT_APP_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.REACT_APP_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

async function publicProfileExists(slug, { env = process.env, fetchImpl = fetch } = {}) {
  const config = getSupabaseConfig(env);
  if (!config) return null;

  const query = new URL(`${config.url}/rest/v1/profiles`);
  query.searchParams.set('select', 'id');
  query.searchParams.set('slug', `eq.${slug}`);
  query.searchParams.set('status', 'eq.active');
  query.searchParams.set('deleted_at', 'is.null');
  query.searchParams.set('limit', '1');

  const res = await fetchImpl(query.toString(), {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

function buildNotFoundResponse() {
  const body = '<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Perfil no encontrado — NexCard</title></head><body style="margin:0;background:#09090b;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:grid;min-height:100vh;place-items:center;text-align:center;padding:24px"><main><p style="color:#10b981;text-transform:uppercase;letter-spacing:.18em;font-size:12px">Perfil público</p><h1>Perfil no encontrado</h1><p style="color:#d4d4d8;max-width:420px">Este perfil no existe, fue desactivado o el enlace no es correcto.</p><a href="/preview" style="color:#10b981">Ir a NexCard</a></main></body></html>';
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
      'x-nexcard-route': 'public-profile-not-found',
    },
  });
}

async function middleware(request) {
  const url = new URL(request.url);
  const slug = getCandidatePublicSlug(url.pathname);
  if (!slug) return next();

  try {
    const exists = await publicProfileExists(slug);
    if (exists === false) return buildNotFoundResponse();
    return next();
  } catch {
    return next();
  }
}

module.exports = middleware;
module.exports.default = middleware;
module.exports.config = {
  matcher: ['/((?!api/|assets/|favicon.ico|favicon.svg|apple-touch-icon.png|og-image.svg|robots.txt|sitemap.xml).*)'],
};
module.exports.getCandidatePublicSlug = getCandidatePublicSlug;
module.exports.publicProfileExists = publicProfileExists;
module.exports.buildNotFoundResponse = buildNotFoundResponse;
