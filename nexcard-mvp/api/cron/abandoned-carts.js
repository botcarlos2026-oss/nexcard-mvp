export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = await fetch(
    'https://ghiremuuyprohdqfrxsy.supabase.co/functions/v1/send-abandoned-cart',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'cron' })
    }
  );

  const data = await response.json();
  return res.status(200).json(data);
}
