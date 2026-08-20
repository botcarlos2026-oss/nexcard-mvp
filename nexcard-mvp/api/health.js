import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://ghiremuuyprohdqfrxsy.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const CHECK_TIMEOUT_MS = 5000;

const withTimeout = (promise, ms) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

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
  // Always 200: Cloudflare replaces the response body of any 502/503/504 from our own
  // app with its own generic error page, which would hide this diagnostic payload
  // during exactly the incident it's meant to help debug (see api/cron/* for the same
  // fix). The `status` field in the payload carries the real health state instead.
  return res.status(200).json(payload);
}
