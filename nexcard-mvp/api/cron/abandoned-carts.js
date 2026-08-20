import { alertTelegram } from '../_lib/alertTelegram.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
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
        body: JSON.stringify({ trigger: 'cron' })
      }
    );
  } catch (error) {
    await alertTelegram('cron/abandoned-carts: send-abandoned-cart inalcanzable', error);
    return res.status(502).json({ success: false, error: `send-abandoned-cart unreachable: ${error.message}` });
  }

  const rawBody = await response.text().catch(() => '');
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })() : null;

  if (!response.ok || data === null) {
    await alertTelegram(
      'cron/abandoned-carts: respuesta inválida de send-abandoned-cart',
      `HTTP ${response.status}: ${rawBody.slice(0, 300)}`
    );
    return res.status(502).json({
      success: false,
      error: `send-abandoned-cart returned ${response.status} non-JSON/error response`,
      body: rawBody.slice(0, 500),
    });
  }

  return res.status(200).json(data);
}
