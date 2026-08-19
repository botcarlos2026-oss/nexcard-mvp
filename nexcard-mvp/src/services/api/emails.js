const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export function createEmailsApi({ supabase, getCurrentUserEmail }) {
  const getEmailDashboardData = async () => {
    const [logRes, unsubRes, ordersRes, waitlistRes] = await Promise.all([
      supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(50),
      supabase.from('email_unsubscribe').select('email'),
      supabase.from('orders').select('customer_email').not('customer_email', 'is', null),
      supabase.from('waitlist').select('email').not('email', 'is', null),
    ]);
    return {
      emailLog: logRes.data || [],
      unsubscribes: unsubRes.data || [],
      orderEmails: ordersRes.data || [],
      waitlistEmails: waitlistRes.data || [],
    };
  };

  const sendCampaignToRecipients = async (recipients, { subject, html }) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      const err = new Error('Debes iniciar sesión como admin para enviar campañas.');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }

    let sent = 0;
    let skipped = 0;
    let errors = 0;
    let rateLimited = 0;

    const sendOne = async (email, attempt = 1) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ to: email, subject, html, email_type: 'campaign' }),
      });
      // Rate limit: esperar y reintentar hasta 3 veces con backoff
      if (res.status === 429 && attempt <= 3) {
        const backoff = attempt * 2000;
        await new Promise((r) => setTimeout(r, backoff));
        return sendOne(email, attempt + 1);
      }
      return res;
    };

    for (const email of recipients) {
      try {
        const res = await sendOne(email);
        if (res.status === 429) {
          rateLimited++;
        } else {
          const data = await res.json();
          if (data.success) sent++;
          else if (data.skipped_reason) skipped++;
          else errors++;
        }
      } catch {
        errors++;
      }
      // Delay 100ms entre envíos para no superar rate limit de Resend
      await new Promise((r) => setTimeout(r, 100));
    }

    return { sent, skipped, errors, rateLimited };
  };

  const sendTestEmail = async ({ subject, html }) => {
    const testEmail = getCurrentUserEmail?.();
    if (!testEmail) {
      throw new Error('No se pudo determinar tu correo de admin para enviar la prueba.');
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error('Debes iniciar sesión como admin para enviar una prueba.');
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ to: testEmail, subject: `[PRUEBA] ${subject}`, html, email_type: 'campaign' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'No fue posible enviar la prueba.');
    }
    return { email: testEmail };
  };

  const sendAbandonedCartReminder = async (cartId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-abandoned-cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ cartId }),
    });
    return res.json();
  };

  return {
    getEmailDashboardData,
    sendCampaignToRecipients,
    sendTestEmail,
    sendAbandonedCartReminder,
  };
}
