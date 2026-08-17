export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let response;
  try {
    response = await fetch(
      'https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/send-abandoned-cart',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'cron' })
      }
    );
  } catch (error) {
    return res.status(502).json({ success: false, error: `send-abandoned-cart unreachable: ${error.message}` });
  }

  const rawBody = await response.text().catch(() => '');
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })() : null;

  if (!response.ok || data === null) {
    return res.status(502).json({
      success: false,
      error: `send-abandoned-cart returned ${response.status} non-JSON/error response`,
      body: rawBody.slice(0, 500),
    });
  }

  return res.status(200).json(data);
}
