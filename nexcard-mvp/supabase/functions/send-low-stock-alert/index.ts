import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const RESEND_API_KEY           = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const items: { name: string; sku: string; stock: number; min_stock: number }[] = body.items || [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const rowsHTML = items.map(i => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #fef3c7;font-weight:700">${i.name || i.sku || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #fef3c7;font-family:monospace;font-size:12px;color:#6b7280">${i.sku || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #fef3c7;text-align:center;font-weight:900;color:#dc2626">${i.stock}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #fef3c7;text-align:center;color:#92400e">${i.min_stock}</td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#09090B;padding:32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:900">Nex<span style="color:#10B981">Card</span></h1>
      <p style="color:#f59e0b;margin:8px 0 0;font-size:14px;font-weight:700">⚠️ Alerta de stock bajo</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;margin:0 0 20px">Los siguientes insumos están por debajo del stock mínimo configurado:</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #fef3c7;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#fef3c7">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">Item</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">SKU</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">Stock actual</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">Mínimo</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
      <div style="margin-top:24px;padding:16px;background:#fef3c7;border-radius:12px">
        <p style="margin:0;color:#92400e;font-size:14px;font-weight:700">Acción requerida</p>
        <p style="margin:4px 0 0;color:#78350f;font-size:13px">Reponer stock antes del próximo despacho para evitar retrasos.</p>
      </div>
      <div style="margin-top:16px;text-align:center">
        <a href="https://nexcard.cl/admin/inventory" style="display:inline-block;background:#09090B;color:white;font-size:13px;font-weight:900;text-decoration:none;padding:12px 28px;border-radius:100px">
          Ver inventario →
        </a>
      </div>
    </div>
    <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #f0f0f0">
      <p style="margin:0;color:#9ca3af;font-size:11px">© 2026 NexCard · nexcard.cl</p>
    </div>
  </div>
</body>
</html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NexCard <hola@nexcard.cl>',
        to: ['carlos.alvarez.contreras@gmail.com'],
        subject: `⚠️ Stock bajo en NexCard — acción requerida (${items.length} ${items.length === 1 ? 'item' : 'items'})`,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      log('error', 'resend_low_stock_failed', { resend_error: resendData });
      return new Response(JSON.stringify({ success: false, error: resendData }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Registrar en email_log
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('email_log').insert([{
        email_type: 'campaign',
        recipient: 'carlos.alvarez.contreras@gmail.com',
        subject: `⚠️ Stock bajo — ${items.length} items`,
        metadata: { items },
      }]);
    } catch {
      // email_log no crítico
    }

    log('info', 'low_stock_alert_sent', { items_count: items.length, resend_id: resendData.id });

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    log('error', 'send_low_stock_alert_exception', { message: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
