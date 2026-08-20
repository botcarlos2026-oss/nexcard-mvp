import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://ghiremuuyprohdqfrxsy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same-origin proxy for the public waitlist signup form. Calling Supabase directly
// from the browser (a cross-origin fetch to *.supabase.co) is exactly the pattern
// third-party ad-blockers and privacy extensions intercept — confirmed live: a real
// visitor's signup failed silently this way while a server-side insert with the same
// payload succeeded immediately. Routing through our own domain sidesteps that
// entirely, since same-origin requests are essentially never blocked.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, error: 'Servicio no configurado' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { error } = await supabase.from('waitlist').insert([{ email }]);
    // 23505 = unique_violation (email already on the list) — treat as success, not error.
    if (error && error.code !== '23505') {
      throw error;
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    // Never 502/503/504 here: Cloudflare replaces the body of those with its own
    // generic error page, hiding this from anyone debugging a real failure later.
    return res.status(500).json({ success: false, error: 'No se pudo guardar' });
  }
}
