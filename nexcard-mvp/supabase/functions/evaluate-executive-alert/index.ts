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
    carrier_delivery_rate_drop_pts: -10,
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

const NON_OPERATIONAL_ORDER_EMAILS = new Set([
  'bot.carlos.2026@gmail.com',
  'carlos.alvarez.contreras@gmail.com',
  'admin@nexcard.cl',
  'carlos@nexcard.cl',
  'hola@nexcard.cl',
]);

const NON_OPERATIONAL_ORDER_NAME_REGEX = /\b(qa|test|tst|smoke|demo|bot)\b/i;

const round1 = (value: number) => Math.round(value * 10) / 10;
const percentage = (num: number, den: number) => (den > 0 ? round1((num / den) * 100) : null);
const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return round1(sorted[index]);
};
const deltaPercent = (current: number, previous: number) => previous ? round1(((current - previous) / previous) * 100) : (current ? 100 : 0);
const uniqById = (rows: any[] = []) => Array.from(new Map(rows.filter(Boolean).map((row) => [row.id, row])).values());
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

const isNonOperationalOrder = (order: any) => {
  if (order?.is_test === true) return true;
  const email = normalizeEmail(order?.customer_email);
  const name = String(order?.customer_name || '').trim();
  if (NON_OPERATIONAL_ORDER_EMAILS.has(email)) return true;
  if (email.endsWith('@nexcard.cl')) return true;
  if (NON_OPERATIONAL_ORDER_NAME_REGEX.test(name)) return true;
  return false;
};

const getStageTimestampMs = (order: any, key: string) => {
  const rawValue = ({
    paid: order.paid_at || order.updated_at || order.created_at,
    ready: order.ready_at,
    shipped: order.shipped_at,
    delivered: order.delivered_at,
    activated: order.activated_at || order.activation_last_at,
  } as Record<string, string | null | undefined>)[key];
  const timestampMs = new Date(rawValue || '').getTime();
  return Number.isNaN(timestampMs) ? NaN : timestampMs;
};

const deriveOrderObservability = ({ order, claim, relatedCards }: { order: any, claim: any, relatedCards: any[] }) => {
  const activeCardsCount = relatedCards.filter((card) => card.status === 'active' || card.activation_status === 'activated').length;
  const programmedCardsCount = relatedCards.filter((card) => card.nfc_url || card.programmed_at || card.status === 'programmed').length;
  const activationClaimed = claim?.status === 'claimed';
  const activationCompleted = Boolean(order.activated_at) || activeCardsCount > 0 || activationClaimed;
  const observabilityAlerts: string[] = [];
  if (order.payment_status === 'paid' && order.fulfillment_status === 'new') observabilityAlerts.push('Pagada sin entrar a producción');
  if (['ready', 'shipped', 'delivered'].includes(order.fulfillment_status) && relatedCards.length === 0) observabilityAlerts.push('Orden avanzada sin card vinculada');
  if (order.fulfillment_status === 'delivered' && !activationCompleted) observabilityAlerts.push('Entregada sin activación cerrada');
  if (claim?.status === 'pending' && order.fulfillment_status === 'delivered') observabilityAlerts.push('Claim pendiente post-entrega');
  const activationLastAt = order.activated_at || (claim?.status === 'claimed' ? claim.updated_at : relatedCards.map((card) => card.activated_at).filter(Boolean).sort().slice(-1)[0]) || null;
  return {
    ...order,
    related_cards: relatedCards,
    activation_claim: claim || null,
    activation_completed: activationCompleted,
    activation_last_at: activationLastAt,
    observability_alerts: observabilityAlerts,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const triggerSource = body?.trigger || 'manual';

    const { data: runtimeRows } = await supabase.from('kpi_runtime_config').select('key, config').eq('active', true);
    const runtimeConfig = (runtimeRows || []).reduce((acc: Record<string, any>, row: any) => {
      acc[row.key] = row.config || {};
      return acc;
    }, {});
    const wow = { ...DEFAULTS.wow, ...(runtimeConfig.wow_alert_thresholds || {}) };
    const policy = { ...DEFAULTS.policy, ...(runtimeConfig.executive_alert_policy || {}) };
    const routing = { ...DEFAULTS.routing, ...(runtimeConfig.executive_alert_routing || {}) };
    const bandPolicy = { ...DEFAULTS.bandPolicy, ...(runtimeConfig.executive_alert_band_policy || {}) };

    const [{ data: orders, error: ordersError }, cardsRes, orderCardsRes, claimsRes, profilesRes] = await Promise.all([
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
      supabase.from('cards').select('id, order_id, profile_id, card_code, status, activation_status, nfc_url, programmed_at, assigned_at, activated_at, created_at, updated_at, deleted_at').is('deleted_at', null),
      supabase.from('order_cards').select('order_id, card_id, linked_by, created_at'),
      supabase.from('profile_claims').select('order_id, card_id, customer_email, status, claimed_by_user_id, claimed_profile_id, created_at, updated_at, expires_at'),
      supabase.from('profiles').select('id, slug, full_name, contact_email, deleted_at').is('deleted_at', null),
    ]);
    if (ordersError) throw ordersError;

    const profiles = profilesRes.data || [];
    const cards = cardsRes.data || [];
    const orderCards = orderCardsRes.data || [];
    const claims = claimsRes.data || [];
    const profileMap = Object.fromEntries(profiles.map((profile: any) => [profile.id, profile]));
    const cardMap = Object.fromEntries(cards.map((card: any) => [card.id, card]));
    const claimByOrderId = Object.fromEntries(claims.map((claim: any) => [claim.order_id, claim]));
    const directCardsByOrderId = cards.reduce((acc: Record<string, any[]>, card: any) => {
      if (!card.order_id) return acc;
      if (!acc[card.order_id]) acc[card.order_id] = [];
      acc[card.order_id].push(card);
      return acc;
    }, {});
    const formalCardsByOrderId = orderCards.reduce((acc: Record<string, any[]>, link: any) => {
      const linkedCard = cardMap[link.card_id];
      if (!linkedCard) return acc;
      if (!acc[link.order_id]) acc[link.order_id] = [];
      acc[link.order_id].push({ ...linkedCard, order_card_linked_at: link.created_at });
      return acc;
    }, {});
    const cardsByEmail = cards.reduce((acc: Record<string, any[]>, card: any) => {
      const email = normalizeEmail(profileMap[card.profile_id]?.contact_email);
      if (!email) return acc;
      if (!acc[email]) acc[email] = [];
      acc[email].push(card);
      return acc;
    }, {});

    const enrichedOrders = (orders || []).map((order: any) => {
      const emailKey = normalizeEmail(order.customer_email);
      const claim = claimByOrderId[order.id] || null;
      const formalCards = formalCardsByOrderId[order.id] || [];
      const directCards = directCardsByOrderId[order.id] || [];
      const heuristicCards = formalCards.length || directCards.length ? [] : (cardsByEmail[emailKey] || []);
      const relatedCards = uniqById([...formalCards, ...directCards, ...heuristicCards]).map((card: any) => ({ ...card, order_id: order.id }));
      return deriveOrderObservability({ order, claim, relatedCards });
    });

    const nowMs = Date.now();
    const operationalOrders = enrichedOrders.filter((order: any) => !isNonOperationalOrder(order));
    const paidOrders = enrichedOrders.filter((order: any) => order.payment_status === 'paid');
    const operationalPaidOrders = paidOrders.filter((order: any) => !isNonOperationalOrder(order));
    const slaBreaches = operationalPaidOrders.filter((order: any) => {
      const paidAtMs = getStageTimestampMs(order, 'paid');
      if (Number.isNaN(paidAtMs)) return false;
      return ((nowMs - paidAtMs) / 36e5) >= 24 && !order.activation_completed;
    });

    const currentStartMs = (() => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - 6);
      return date.getTime();
    })();
    const previousStartMs = currentStartMs - (7 * 24 * 60 * 60 * 1000);
    const previousEndMs = currentStartMs;
    const inRange = (timestampMs: number, fromMs: number, toMs: number) => timestampMs >= fromMs && timestampMs < toMs;
    const currentWindowOperationalOrders = operationalOrders.filter((order: any) => inRange(new Date(order.created_at || 0).getTime(), currentStartMs, nowMs + 1));
    const previousWindowOperationalOrders = operationalOrders.filter((order: any) => inRange(new Date(order.created_at || 0).getTime(), previousStartMs, previousEndMs));
    const currentWindowPaidOrders = operationalPaidOrders.filter((order: any) => inRange(getStageTimestampMs(order, 'paid'), currentStartMs, nowMs + 1));
    const previousWindowPaidOrders = operationalPaidOrders.filter((order: any) => inRange(getStageTimestampMs(order, 'paid'), previousStartMs, previousEndMs));
    const currentWindowRevenue = currentWindowPaidOrders.reduce((sum: number, order: any) => sum + (order.amount_cents || 0), 0);
    const previousWindowRevenue = previousWindowPaidOrders.reduce((sum: number, order: any) => sum + (order.amount_cents || 0), 0);
    const currentWindowPaymentRate = currentWindowOperationalOrders.length ? (currentWindowPaidOrders.length / currentWindowOperationalOrders.length) * 100 : 0;
    const previousWindowPaymentRate = previousWindowOperationalOrders.length ? (previousWindowPaidOrders.length / previousWindowOperationalOrders.length) * 100 : 0;
    const kpiComparisons = {
      revenue_7d: { current: currentWindowRevenue, previous: previousWindowRevenue, delta_pct: deltaPercent(currentWindowRevenue, previousWindowRevenue) },
      payment_rate_7d: { current: round1(currentWindowPaymentRate), previous: round1(previousWindowPaymentRate), delta_pts: round1(currentWindowPaymentRate - previousWindowPaymentRate) },
    };

    const window30dStartMs = (() => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - 29);
      return date.getTime();
    })();
    const rolling30dPaidOrders = operationalPaidOrders.filter((order: any) => inRange(getStageTimestampMs(order, 'paid'), window30dStartMs, nowMs + 1));
    const rolling30dShippedOrders = operationalPaidOrders.filter((order: any) => inRange(getStageTimestampMs(order, 'shipped'), window30dStartMs, nowMs + 1));
    const carrierStats = Object.values(rolling30dShippedOrders.reduce((acc: Record<string, any>, order: any) => {
      const key = order.carrier || 'Sin carrier';
      if (!acc[key]) acc[key] = { key, label: key, orders: 0, delivered: 0, delivered_to_activation_hours: [] as number[] };
      acc[key].orders += 1;
      if (order.fulfillment_status === 'delivered') acc[key].delivered += 1;
      const deliveredAtMs = getStageTimestampMs(order, 'delivered');
      const activatedAtMs = getStageTimestampMs(order, 'activated');
      if (!Number.isNaN(deliveredAtMs) && !Number.isNaN(activatedAtMs) && activatedAtMs >= deliveredAtMs) {
        acc[key].delivered_to_activation_hours.push((activatedAtMs - deliveredAtMs) / 36e5);
      }
      return acc;
    }, {})).map((item: any) => ({ ...item, delivery_rate: percentage(item.delivered, item.orders), p90_delivery_to_activation_hours: percentile(item.delivered_to_activation_hours, 90) }));
    const productStats = Object.values(rolling30dPaidOrders.reduce((acc: Record<string, any>, order: any) => {
      (order.order_items || []).forEach((item: any) => {
        const key = item.product_id || item.product_name || 'Sin producto';
        if (!acc[key]) acc[key] = { key, label: item.product_name || key, quantity: 0, revenue: 0, claims: 0, orders: new Set<string>() };
        const quantity = Number(item.quantity) || 0;
        const lineRevenue = item.unit_price_cents != null ? (Number(item.unit_price_cents) || 0) * quantity : ((order.amount_cents || 0) / Math.max((order.order_items || []).length, 1));
        acc[key].quantity += quantity;
        acc[key].revenue += lineRevenue;
        acc[key].orders.add(order.id);
        if (order.activation_claim?.status === 'pending') acc[key].claims += 1;
      });
      return acc;
    }, {})).map((item: any) => ({ ...item, order_count: item.orders.size, claim_rate: percentage(item.claims, item.orders.size) })).sort((a: any, b: any) => (b.revenue - a.revenue) || (b.quantity - a.quantity)).slice(0, 5);
    const previous30dStartMs = window30dStartMs - (30 * 24 * 60 * 60 * 1000);
    const previous30dEndMs = window30dStartMs;
    const previous30dShippedOrders = operationalPaidOrders.filter((order: any) => inRange(getStageTimestampMs(order, 'shipped'), previous30dStartMs, previous30dEndMs));
    const previousCarrierRateMap = Object.values(previous30dShippedOrders.reduce((acc: Record<string, any>, order: any) => {
      const key = order.carrier || 'Sin carrier';
      if (!acc[key]) acc[key] = { key, orders: 0, delivered: 0 };
      acc[key].orders += 1;
      if (order.fulfillment_status === 'delivered') acc[key].delivered += 1;
      return acc;
    }, {})).reduce((acc: Record<string, any>, item: any) => {
      acc[item.key] = percentage(item.delivered, item.orders);
      return acc;
    }, {});

    const wowAlerts: any[] = [];
    if ((kpiComparisons.revenue_7d?.delta_pct ?? 0) <= wow.revenue_drop_pct) wowAlerts.push({ key: 'revenue_drop', severity: 'danger', title: 'Revenue 7d cayó fuerte vs período previo', detail: `${kpiComparisons.revenue_7d.delta_pct}% vs ventana previa` });
    if ((kpiComparisons.payment_rate_7d?.delta_pts ?? 0) <= wow.payment_rate_drop_pts) wowAlerts.push({ key: 'payment_rate_drop', severity: 'warning', title: 'Tasa de pago cayó WoW', detail: `${kpiComparisons.payment_rate_7d.delta_pts} pts vs ventana previa` });
    carrierStats.forEach((carrier: any) => {
      const previousRate = previousCarrierRateMap[carrier.key];
      if (previousRate != null && carrier.delivery_rate != null && (carrier.delivery_rate - previousRate) <= wow.carrier_delivery_rate_drop_pts) {
        wowAlerts.push({ key: `carrier_${carrier.key}`, severity: 'warning', title: `Carrier ${carrier.label} empeoró tasa de entrega`, detail: `${round1(carrier.delivery_rate - previousRate)} pts vs ventana previa` });
      }
    });
    productStats.forEach((product: any) => {
      if ((product.claim_rate ?? 0) >= wow.sku_claim_rate_pct) {
        wowAlerts.push({ key: `sku_claim_${product.key}`, severity: 'danger', title: `SKU con claim rate alto: ${product.label}`, detail: `${product.claim_rate}% claim rate sobre ${product.order_count} órdenes` });
      }
    });

    let score = 100;
    const reasons: string[] = [];
    const revenueDelta = kpiComparisons.revenue_7d?.delta_pct ?? 0;
    const paymentRateDelta = kpiComparisons.payment_rate_7d?.delta_pts ?? 0;
    if (revenueDelta < 0) { score -= Math.min(25, Math.abs(revenueDelta) * 0.6); reasons.push(`Revenue 7d ${revenueDelta}%`); }
    if (paymentRateDelta < 0) { score -= Math.min(20, Math.abs(paymentRateDelta) * 1.5); reasons.push(`Pago ${paymentRateDelta} pts`); }
    score -= Math.min(20, slaBreaches.length * 2);
    score -= Math.min(15, wowAlerts.length * 3);
    const avgClaimRate = productStats.length ? productStats.reduce((sum: number, item: any) => sum + (item.claim_rate || 0), 0) / productStats.length : 0;
    if (avgClaimRate > 0) { score -= Math.min(20, avgClaimRate * 1.2); reasons.push(`Claim avg ${round1(avgClaimRate)}%`); }
    const finalScore = Math.max(0, round1(score));
    const band = finalScore >= 85 ? 'strong' : finalScore >= 70 ? 'healthy' : finalScore >= 50 ? 'watch' : 'critical';

    const { data: alertState } = await supabase.from('kpi_alert_state').select('*').eq('alert_key', 'executive_score').maybeSingle();
    const alertBandRank = band === 'critical' ? 2 : band === 'watch' ? 1 : 0;
    const minimumBandRank = band === 'critical' ? Number(policy.min_band_critical || 1) : Number(policy.min_band_watch || 1);
    const cooldownMinutes = band === 'critical' ? Number(bandPolicy.critical_cooldown_minutes ?? policy.cooldown_minutes ?? 0) : Number(bandPolicy.watch_cooldown_minutes ?? policy.cooldown_minutes ?? 0);
    const lastSentAtMs = new Date(alertState?.last_sent_at || '').getTime();
    const inCooldown = Number.isFinite(lastSentAtMs) && !Number.isNaN(lastSentAtMs) && cooldownMinutes > 0 && (nowMs - lastSentAtMs) < (cooldownMinutes * 60 * 1000);
    const blockedBySameBand = Number(policy.dedupe_by_band || 0) === 1 && alertState?.last_band === band;
    const killSwitchActive = Number(bandPolicy.kill_switch || 0) === 1;
    const shouldSend = !killSwitchActive && Number(policy.enabled || 0) === 1 && alertBandRank >= minimumBandRank && alertBandRank > 0 && !inCooldown && !blockedBySameBand;
    const recipients = String((band === 'critical' ? bandPolicy.critical_recipients_csv : bandPolicy.watch_recipients_csv) || routing.recipients_csv || '').split(',').map((item: string) => item.trim()).filter(Boolean);

    const payload = {
      event: 'nexcard.executive_score_alert',
      score: finalScore,
      band,
      reasons: reasons.slice(0, 4),
      summary: `NexCard | score ${finalScore} | revenue ${revenueDelta}% | pago ${paymentRateDelta} pts | SLA rotos ${slaBreaches.length}`,
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
      payload: {
        payload,
        dispatch_result: dispatchResult,
        recipients,
        revenue_delta: revenueDelta,
        payment_rate_delta: paymentRateDelta,
        sla_breaches: slaBreaches.length,
        wow_alerts: wowAlerts,
        carrier_stats: carrierStats,
        product_stats: productStats,
        avg_claim_rate: round1(avgClaimRate || 0),
      },
    });

    return new Response(JSON.stringify({ success: true, trigger: triggerSource, score: finalScore, band, should_send: shouldSend, dispatched, dry_run: dryRun, blocked_reason: blockedReason, recipients, dispatch_result: dispatchResult }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
