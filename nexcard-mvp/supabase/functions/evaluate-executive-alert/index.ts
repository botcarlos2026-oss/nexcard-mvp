import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULTS = {
  wow: {
    revenue_drop_pct: -20,
    payment_rate_drop_pts: -8,
    sku_claim_rate_pct: 8,
  },
  policy: {
    enabled: 1,
    cooldown_minutes: 180,
    dedupe_by_band: 1,
    min_band_watch: 1,
    min_band_critical: 1,
  },
  routing: {
    enabled: 1,
    auto_dispatch: 0,
    dry_run_default: 1,
    recipients_csv: 'carlos.alvarez.contreras@gmail.com,bot.carlos.2026@gmail.com',
  },
  bandPolicy: {
    kill_switch: 0,
    watch_cooldown_minutes: 180,
    critical_cooldown_minutes: 60,
    watch_recipients_csv: 'bot.carlos.2026@gmail.com',
    critical_recipients_csv: 'carlos.alvarez.contreras@gmail.com,bot.carlos.2026@gmail.com',
  },
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const deltaPercent = (current: number, previous: number) => previous ? round1(((current - previous) / previous) * 100) : (current ? 100 : 0);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const triggerSource = body?.trigger || 'manual';

    const { data: runtimeRows } = await supabase
      .from('kpi_runtime_config')
      .select('key, config')
      .eq('active', true);

    const runtimeConfig = (runtimeRows || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.key] = row.config || {};
      return acc;
    }, {});

    const wow = { ...DEFAULTS.wow, ...(runtimeConfig.wow_alert_thresholds || {}) };
    const policy = { ...DEFAULTS.policy, ...(runtimeConfig.executive_alert_policy || {}) };
    const routing = { ...DEFAULTS.routing, ...(runtimeConfig.executive_alert_routing || {}) };
    const bandPolicy = { ...DEFAULTS.bandPolicy, ...(runtimeConfig.executive_alert_band_policy || {}) };

    const now = Date.now();
    const currentStart = new Date(); currentStart.setHours(0,0,0,0); currentStart.setDate(currentStart.getDate() - 6);
    const prevStart = new Date(currentStart); prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = currentStart.getTime();
    const currentStartMs = currentStart.getTime();
    const prevStartMs = prevStart.getTime();
    const inRange = (ts: number, from: number, to: number) => ts >= from && ts < to;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, paid_at, updated_at, amount_cents, payment_status, fulfillment_status, activation_completed, is_test, test_reason, customer_email');
    if (ordersError) throw ordersError;

    const filteredOrders = (orders || []).filter((o: any) => !o.is_test && !(String(o.customer_email || '').toLowerCase().endsWith('@nexcard.cl')));
    const paidOrders = filteredOrders.filter((o: any) => o.payment_status === 'paid');
    const paidAtMs = (o: any) => new Date(o.paid_at || o.updated_at || o.created_at || 0).getTime();
    const createdAtMs = (o: any) => new Date(o.created_at || 0).getTime();

    const currentWindowOperational = filteredOrders.filter((o: any) => inRange(createdAtMs(o), currentStartMs, now + 1));
    const prevWindowOperational = filteredOrders.filter((o: any) => inRange(createdAtMs(o), prevStartMs, prevEnd));
    const currentWindowPaid = paidOrders.filter((o: any) => inRange(paidAtMs(o), currentStartMs, now + 1));
    const prevWindowPaid = paidOrders.filter((o: any) => inRange(paidAtMs(o), prevStartMs, prevEnd));

    const currentRevenue = currentWindowPaid.reduce((sum: number, o: any) => sum + (o.amount_cents || 0), 0);
    const prevRevenue = prevWindowPaid.reduce((sum: number, o: any) => sum + (o.amount_cents || 0), 0);
    const revenueDelta = deltaPercent(currentRevenue, prevRevenue);
    const currentPaymentRate = currentWindowOperational.length ? (currentWindowPaid.length / currentWindowOperational.length) * 100 : 0;
    const prevPaymentRate = prevWindowOperational.length ? (prevWindowPaid.length / prevWindowOperational.length) * 100 : 0;
    const paymentRateDelta = round1(currentPaymentRate - prevPaymentRate);

    const slaBreaches = paidOrders.filter((o: any) => {
      const paidMs = paidAtMs(o);
      if (Number.isNaN(paidMs)) return false;
      return ((now - paidMs) / 36e5) >= 24 && !o.activation_completed;
    }).length;

    const wowAlerts: any[] = [];
    if (revenueDelta <= wow.revenue_drop_pct) wowAlerts.push({ key: 'revenue_drop', severity: 'danger', detail: `${revenueDelta}%` });
    if (paymentRateDelta <= wow.payment_rate_drop_pts) wowAlerts.push({ key: 'payment_drop', severity: 'warning', detail: `${paymentRateDelta} pts` });

    let score = 100;
    const reasons: string[] = [];
    if (revenueDelta < 0) { score -= Math.min(25, Math.abs(revenueDelta) * 0.6); reasons.push(`Revenue 7d ${revenueDelta}%`); }
    if (paymentRateDelta < 0) { score -= Math.min(20, Math.abs(paymentRateDelta) * 1.5); reasons.push(`Pago ${paymentRateDelta} pts`); }
    score -= Math.min(20, slaBreaches * 2);
    score -= Math.min(15, wowAlerts.length * 3);
    const finalScore = Math.max(0, round1(score));
    const band = finalScore >= 85 ? 'strong' : finalScore >= 70 ? 'healthy' : finalScore >= 50 ? 'watch' : 'critical';

    const alertBandRank = band === 'critical' ? 2 : band === 'watch' ? 1 : 0;
    const minimumBandRank = band === 'critical' ? Number(policy.min_band_critical || 1) : Number(policy.min_band_watch || 1);
    const { data: alertState } = await supabase.from('kpi_alert_state').select('*').eq('alert_key', 'executive_score').maybeSingle();
    const cooldownMinutes = band === 'critical' ? Number(bandPolicy.critical_cooldown_minutes ?? policy.cooldown_minutes ?? 0) : Number(bandPolicy.watch_cooldown_minutes ?? policy.cooldown_minutes ?? 0);
    const lastSentAtMs = new Date(alertState?.last_sent_at || '').getTime();
    const inCooldown = Number.isFinite(lastSentAtMs) && !Number.isNaN(lastSentAtMs) && cooldownMinutes > 0 && (now - lastSentAtMs) < (cooldownMinutes * 60 * 1000);
    const blockedBySameBand = Number(policy.dedupe_by_band || 0) === 1 && alertState?.last_band === band;
    const killSwitchActive = Number(bandPolicy.kill_switch || 0) === 1;
    const shouldSend = !killSwitchActive && Number(policy.enabled || 0) === 1 && alertBandRank >= minimumBandRank && alertBandRank > 0 && !inCooldown && !blockedBySameBand;
    const recipients = String(band === 'critical' ? bandPolicy.critical_recipients_csv : bandPolicy.watch_recipients_csv || routing.recipients_csv || '')
      .split(',').map((item: string) => item.trim()).filter(Boolean);

    const payload = {
      event: 'nexcard.executive_score_alert',
      score: finalScore,
      band,
      reasons: reasons.slice(0, 4),
      summary: `NexCard | score ${finalScore} | revenue ${revenueDelta}% | pago ${paymentRateDelta} pts | SLA rotos ${slaBreaches}`,
      generated_at: new Date().toISOString(),
    };

    let dispatched = false;
    let dispatchResult: any = null;
    const dryRun = Number(routing.dry_run_default || 0) === 1;
    if (shouldSend && Number(routing.enabled || 0) === 1 && Number(routing.auto_dispatch || 0) === 1) {
      const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/send-executive-alert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alert_key: 'executive_score', payload, dry_run: dryRun, recipients }),
      });
      dispatchResult = await invokeRes.json();
      dispatched = invokeRes.ok && !dispatchResult?.error && !dispatchResult?.skipped;
    }

    const blockedReason = killSwitchActive ? 'kill_switch_active' : (alertBandRank === 0 ? 'below_band' : inCooldown ? 'cooldown_active' : blockedBySameBand ? 'same_band_dedup' : null);
    await supabase.from('kpi_alert_evaluations').insert({
      trigger_source: triggerSource,
      score: finalScore,
      band,
      should_send: shouldSend,
      dispatched,
      dry_run: dryRun,
      blocked_reason: blockedReason,
      payload: { payload, dispatch_result: dispatchResult, recipients, revenue_delta: revenueDelta, payment_rate_delta: paymentRateDelta, sla_breaches: slaBreaches, wow_alerts: wowAlerts },
    });

    return new Response(JSON.stringify({
      success: true,
      trigger: triggerSource,
      score: finalScore,
      band,
      should_send: shouldSend,
      dispatched,
      dry_run: dryRun,
      blocked_reason: blockedReason,
      recipients,
      dispatch_result: dispatchResult,
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
