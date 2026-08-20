import { timingSafeEqual } from 'node:crypto';
import { alertTelegram } from '../_lib/alertTelegram.js';

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function run(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !safeEqual(req.headers.authorization || '', `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    await alertTelegram('cron/abandoned-carts: SUPABASE_SERVICE_ROLE_KEY no configurado', 'La variable de entorno falta en Vercel');
    return res.status(500).json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurado' });
  }

  let response;
  try {
    response = await fetch(
      'https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/send-abandoned-cart',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({ trigger: 'cron' }),
        signal: AbortSignal.timeout(8000),
      }
    );
  } catch (error) {
    await alertTelegram('cron/abandoned-carts: send-abandoned-cart inalcanzable', error);
    // 500, no 502: Cloudflare reemplaza el body de cualquier respuesta 502/503/504
    // del origen por su propia página de error genérica, aunque la función haya
    // respondido correctamente — nos deja ciegos desde afuera aunque adentro esté bien.
    return res.status(500).json({ success: false, error: `send-abandoned-cart unreachable: ${error.message}` });
  }

  const rawBody = await response.text().catch(() => '');
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })() : null;

  if (!response.ok || data === null) {
    await alertTelegram(
      'cron/abandoned-carts: respuesta inválida de send-abandoned-cart',
      `HTTP ${response.status}: ${rawBody.slice(0, 300)}`
    );
    return res.status(500).json({
      success: false,
      error: `send-abandoned-cart returned ${response.status} non-JSON/error response`,
      body: rawBody.slice(0, 500),
    });
  }

  return res.status(200).json(data);
}

export default async function handler(req, res) {
  try {
    return await run(req, res);
  } catch (error) {
    // Red de seguridad final: sin esto, cualquier excepción no prevista tumba
    // la invocación entera (502 crudo de Cloudflare, sin rastro del motivo real).
    console.error('cron/abandoned-carts crashed', error);
    try {
      await alertTelegram('cron/abandoned-carts: excepción no manejada', error);
    } catch {
      // no-op
    }
    return res.status(500).json({
      success: false,
      crashed: true,
      error: error?.message || String(error),
      stack: (error?.stack || '').split('\n').slice(0, 6).join('\n'),
    });
  }
}
