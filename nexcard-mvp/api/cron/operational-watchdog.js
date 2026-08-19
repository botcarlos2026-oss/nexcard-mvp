import { createClient } from '@supabase/supabase-js';
import { alertTelegram } from '../_lib/alertTelegram.js';

const SUPABASE_URL = 'https://ghiremuuyprohdqfrxsy.supabase.co';
const PENDING_HOURS_THRESHOLD = 2;
const SLA_ACTIVATION_HOURS_THRESHOLD = 24;
const ALERT_COOLDOWN_MINUTES = 60;
const STATE_ROW_ID = 'default';

const hoursSince = (isoDate) => {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return ms / (1000 * 60 * 60);
};

const round1 = (value) => Math.round(value * 10) / 10;

const fetchAlerts = async (supabase) => {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, folio, customer_email, payment_status, is_test, created_at, paid_at, activated_at, mp_payment_id, mp_preference_id')
    .is('deleted_at', null)
    .not('payment_status', 'in', '(cancelled,refunded,failed)');

  if (error) throw error;

  const realOrders = (orders || []).filter((order) => !order.is_test);

  const stuckPending = realOrders.filter((order) => (
    order.payment_status === 'pending'
    && (hoursSince(order.created_at) ?? 0) >= PENDING_HOURS_THRESHOLD
  ));

  const webhookMismatch = realOrders.filter((order) => (
    order.payment_status === 'paid' && !order.mp_payment_id
  ));

  const slaBreach = realOrders.filter((order) => (
    order.payment_status === 'paid'
    && !order.activated_at
    && (hoursSince(order.paid_at) ?? 0) >= SLA_ACTIVATION_HOURS_THRESHOLD
  ));

  return { stuckPending, webhookMismatch, slaBreach };
};

const formatOrderLine = (order, hoursField) => {
  const label = order.folio || order.id;
  const hours = round1(hoursSince(order[hoursField]) ?? 0);
  return `• ${label} — ${order.customer_email || 'sin email'} (${hours}h)`;
};

const buildMessage = ({ stuckPending, webhookMismatch, slaBreach }) => {
  const sections = [];

  if (stuckPending.length) {
    sections.push(
      `⏳ *Pagos pendientes >${PENDING_HOURS_THRESHOLD}h* (${stuckPending.length})\n`
      + stuckPending.map((o) => formatOrderLine(o, 'created_at')).join('\n')
    );
  }

  if (webhookMismatch.length) {
    sections.push(
      `⚠️ *Pagadas sin mp_payment_id* (${webhookMismatch.length}) — posible webhook perdido\n`
      + webhookMismatch.map((o) => formatOrderLine(o, 'paid_at')).join('\n')
    );
  }

  if (slaBreach.length) {
    sections.push(
      `🐢 *SLA activación >${SLA_ACTIVATION_HOURS_THRESHOLD}h* (${slaBreach.length})\n`
      + slaBreach.map((o) => formatOrderLine(o, 'paid_at')).join('\n')
    );
  }

  if (!sections.length) return null;

  return `🚨 *NexCard — alerta operativa*\n\n${sections.join('\n\n')}`;
};

const buildFingerprint = ({ stuckPending, webhookMismatch, slaBreach }) => [
  ...stuckPending.map((o) => `p:${o.id}`),
  ...webhookMismatch.map((o) => `w:${o.id}`),
  ...slaBreach.map((o) => `s:${o.id}`),
].sort().join(',');

const sendTelegramMessage = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID no configurados');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Telegram sendMessage falló: ${response.status} ${body.slice(0, 300)}`);
  }
};

// Dead-man's-switch: si este ping deja de llegar, el monitor de heartbeat
// externo (UptimeRobot) avisa que el cron dejó de ejecutarse — sin depender
// de que el propio cron esté vivo para reportar su ausencia.
const pingHeartbeat = async () => {
  const url = process.env.HEARTBEAT_URL;
  if (!url) return;
  try {
    await fetch(url, { method: 'GET' });
  } catch {
    // best-effort
  }
};

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await pingHeartbeat();

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado' });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let alerts;
  try {
    alerts = await fetchAlerts(supabase);
  } catch (error) {
    await alertTelegram('operational-watchdog: fallo consultando orders', error);
    return res.status(502).json({ error: `Fallo consultando orders: ${error.message}` });
  }

  const message = buildMessage(alerts);
  if (!message) {
    return res.status(200).json({ success: true, alerts: 0 });
  }

  const fingerprint = buildFingerprint(alerts);

  const { data: state } = await supabase
    .from('watchdog_alert_state')
    .select('last_alert_at, last_fingerprint')
    .eq('id', STATE_ROW_ID)
    .maybeSingle();

  const sameIssue = state?.last_fingerprint === fingerprint;
  const withinCooldown = sameIssue
    && state?.last_alert_at
    && (hoursSince(state.last_alert_at) ?? Infinity) * 60 < ALERT_COOLDOWN_MINUTES;

  if (withinCooldown) {
    return res.status(200).json({ success: true, alerts: fingerprint.split(',').length, suppressed: 'cooldown' });
  }

  try {
    await sendTelegramMessage(message);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }

  await supabase
    .from('watchdog_alert_state')
    .upsert({ id: STATE_ROW_ID, last_alert_at: new Date().toISOString(), last_fingerprint: fingerprint, updated_at: new Date().toISOString() });

  return res.status(200).json({
    success: true,
    alerts: fingerprint.split(',').length,
    breakdown: {
      stuckPending: alerts.stuckPending.length,
      webhookMismatch: alerts.webhookMismatch.length,
      slaBreach: alerts.slaBreach.length,
    },
  });
}
