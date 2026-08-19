import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://ghiremuuyprohdqfrxsy.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const CHECK_TIMEOUT_MS = 5000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
]);

export default async function handler(req, res) {
  const startedAt = Date.now();
  const checks = { database: 'unknown' };
  let healthy = true;

  if (!SUPABASE_ANON_KEY) {
    checks.database = 'misconfigured';
    healthy = false;
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error } = await withTimeout(
        supabase.from('products').select('id', { head: true, count: 'exact' }).limit(1),
        CHECK_TIMEOUT_MS
      );
      if (error) throw error;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }
  }

  const payload = {
    status: healthy ? 'ok' : 'degraded',
    checks,
    latency_ms: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(healthy ? 200 : 503).json(payload);
}
