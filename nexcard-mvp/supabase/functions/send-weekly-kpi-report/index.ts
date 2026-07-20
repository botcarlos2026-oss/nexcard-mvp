import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.0";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_RECIPIENTS = [
  'carlos.alvarez.contreras@gmail.com',
  'bot.carlos.2026@gmail.com',
];

const log = (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, event, data, ts: new Date().toISOString() }));
};

const fmtCLP = (cents: number | null | undefined) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
    .format(cents || 0);

const fmtMonth = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(new Date(iso));
};

const pct = (num: number, den: number) => den ? `${Math.round((num / den) * 100)}%` : '0%';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const RESEND_API_KEY            = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cargar vistas KPI en paralelo
    const [funnelRes, revenueRes, topRes, cohortsRes] = await Promise.all([
      supabase.from('kpi_funnel').select('*').single(),
      supabase.from('kpi_monthly_revenue').select('*').limit(6),
      supabase.from('kpi_top_products').select('*').limit(5),
      supabase.from('kpi_cohorts').select('*').limit(6),
    ]);

    if (funnelRes.error)   throw new Error(`kpi_funnel: ${funnelRes.error.message}`);
    if (revenueRes.error)  throw new Error(`kpi_monthly_revenue: ${revenueRes.error.message}`);
    if (topRes.error)      throw new Error(`kpi_top_products: ${topRes.error.message}`);
    if (cohortsRes.error)  throw new Error(`kpi_cohorts: ${cohortsRes.error.message}`);

    const funnel = funnelRes.data || {
      waitlist_signups: 0, abandoned_carts_30d: 0, paid_orders_30d: 0, delivered_orders_30d: 0,
    };
    const revenue     = revenueRes.data || [];
    const topProducts = topRes.data || [];
    const cohorts     = cohortsRes.data || [];

    const conversionRate  = pct(funnel.paid_orders_30d, funnel.waitlist_signups + funnel.abandoned_carts_30d + funnel.paid_orders_30d);
    const fulfillmentRate = pct(funnel.delivered_orders_30d, funnel.paid_orders_30d);

    const currentMonthRevenue = revenue[0]?.revenue_cents || 0;

    // Filas
    const revenueRows = revenue.map((r: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${fmtMonth(r.month)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280">${r.orders_count}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#10B981">${fmtCLP(r.revenue_cents)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280">${fmtCLP(r.avg_ticket_cents)}</td>
      </tr>`).join('');

    const productRows = topProducts.map((p: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;color:#6b7280">${p.sku || '—'}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0">${p.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280">${p.units_sold}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#10B981">${fmtCLP(p.revenue_cents)}</td>
      </tr>`).join('');

    const cohortRows = cohorts.map((c: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-transform:capitalize">${fmtMonth(c.cohort_month)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280">${c.new_customers}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280">${c.repeat_customers}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#10B981">${pct(c.repeat_customers, c.new_customers)}</td>
      </tr>`).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:680px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#09090B;padding:32px;text-align:center">
      <h1 style="color:white;margin:0;font-size:24px;font-weight:900">Nex<span style="color:#10B981">Card</span></h1>
      <p style="color:#10B981;margin:8px 0 0;font-size:14px;font-weight:700">Reporte semanal de KPIs</p>
    </div>

    <div style="padding:32px">
      <!-- Funnel -->
      <h2 style="color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Funnel últimos 30 días</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="width:25%;padding:14px;background:#f9fafb;border-radius:12px 0 0 12px;text-align:center">
            <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700">Waitlist</div>
            <div style="font-size:22px;font-weight:900;color:#111827;margin-top:4px">${funnel.waitlist_signups}</div>
          </td>
          <td style="width:25%;padding:14px;background:#f9fafb;border-left:1px solid #e5e7eb;text-align:center">
            <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700">Carritos abandonados</div>
            <div style="font-size:22px;font-weight:900;color:#f59e0b;margin-top:4px">${funnel.abandoned_carts_30d}</div>
          </td>
          <td style="width:25%;padding:14px;background:#f9fafb;border-left:1px solid #e5e7eb;text-align:center">
            <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700">Pagadas</div>
            <div style="font-size:22px;font-weight:900;color:#10B981;margin-top:4px">${funnel.paid_orders_30d}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">conv ${conversionRate}</div>
          </td>
          <td style="width:25%;padding:14px;background:#f9fafb;border-left:1px solid #e5e7eb;border-radius:0 12px 12px 0;text-align:center">
            <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700">Entregadas</div>
            <div style="font-size:22px;font-weight:900;color:#10B981;margin-top:4px">${funnel.delivered_orders_30d}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">${fulfillmentRate}</div>
          </td>
        </tr>
      </table>

      <!-- Revenue resumen mes -->
      <div style="background:#10B981;color:white;border-radius:12px;padding:18px;margin-bottom:24px;text-align:center">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;opacity:0.9;font-weight:700">Revenue mes en curso</div>
        <div style="font-size:30px;font-weight:900;margin-top:6px">${fmtCLP(currentMonthRevenue)}</div>
      </div>

      <!-- Revenue mensual -->
      <h2 style="color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Revenue mensual</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Mes</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Órdenes</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Revenue</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Ticket prom</th>
          </tr>
        </thead>
        <tbody>${revenueRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af">Sin órdenes pagadas todavía</td></tr>'}</tbody>
      </table>

      <!-- Top productos -->
      <h2 style="color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Top productos</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">SKU</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Producto</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Unid</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Revenue</th>
          </tr>
        </thead>
        <tbody>${productRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af">Sin ventas registradas</td></tr>'}</tbody>
      </table>

      <!-- Cohorts -->
      <h2 style="color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px">Retención por cohorte</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Cohorte</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Nuevos</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Recompra</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Tasa</th>
          </tr>
        </thead>
        <tbody>${cohortRows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#9ca3af">Sin datos de retención</td></tr>'}</tbody>
      </table>

      <div style="text-align:center;margin-top:8px">
        <a href="https://nexcard.cl/admin/kpis" style="display:inline-block;background:#09090B;color:white;font-size:13px;font-weight:900;text-decoration:none;padding:12px 28px;border-radius:100px">
          Ver dashboard completo →
        </a>
      </div>
    </div>

    <div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #f0f0f0">
      <p style="margin:0;color:#9ca3af;font-size:11px">© 2026 NexCard · Reporte automático semanal</p>
    </div>
  </div>
</body>
</html>`;

    const subject = `📊 KPI semanal NexCard — ${funnel.paid_orders_30d} pagadas (${fmtCLP(currentMonthRevenue)} mes)`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NexCard <hola@nexcard.cl>',
        to: ADMIN_RECIPIENTS,
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      log('error', 'resend_weekly_kpi_failed', { resend_error: resendData });
      return new Response(JSON.stringify({ success: false, error: resendData }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    try {
      await supabase.from('email_log').insert([{
        email_type: 'campaign',
        recipient: ADMIN_RECIPIENTS.join(','),
        subject,
        metadata: {
          funnel,
          current_month_revenue_cents: currentMonthRevenue,
          revenue_months: revenue.length,
          top_products_count: topProducts.length,
          cohorts_count: cohorts.length,
        },
      }]);
    } catch {
      // email_log no crítico
    }

    log('info', 'weekly_kpi_report_sent', {
      resend_id: resendData.id,
      paid_orders_30d: funnel.paid_orders_30d,
      revenue_current_month: currentMonthRevenue,
    });

    return new Response(JSON.stringify({ success: true, resend_id: resendData.id }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    log('error', 'send_weekly_kpi_exception', { message: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
