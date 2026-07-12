#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const cwd = process.cwd();
const args = process.argv.slice(2);
const DEFAULT_SKU = 'NEXCARD-MP-TEST-1000';
const EXPECTED_AMOUNT_CENTS = 1000;
const DEMO_NEEDLES = [
  'Juan Pérez',
  'Grupo Alvarez SpA',
  'juan.perez@grupoalvarez.cl',
  'randomuser',
  'Banco Santander',
];

const argValue = (name) => {
  const match = args.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (!match) return null;
  const [, value = ''] = match.split('=');
  return value.trim() || null;
};

const hasFlag = (name) => args.includes(`--${name}`);

const printUsage = () => {
  console.log([
    'Uso:',
    '  node scripts/validate-friend-purchase.mjs --order-id=<uuid> [--sku=NEXCARD-MP-TEST-1000]',
    '  node scripts/validate-friend-purchase.mjs --email=<correo> [--sku=NEXCARD-MP-TEST-1000]',
    '',
    'Valida read-only: Supabase order, Mercado Pago approved, payment ledger, perfil sin demo, slug único y lane Kanban.',
  ].join('\n'));
};

const loadEnvFile = (file) => {
  if (!file) return;
  const fullPath = path.isAbsolute(file) ? file : path.join(cwd, file);
  if (!fs.existsSync(fullPath)) return;
  const content = fs.readFileSync(fullPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const rawValue = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  });
};

[
  '.env',
  '.env.local',
  '.env.e2e.local',
  '.env.secrets',
  '../.env.secrets',
  '../../.env.secrets',
  '/Users/openclow-worker/Documents/business-workspace/.env',
  process.env.NEXCARD_SECRETS_FILE,
].forEach(loadEnvFile);

const finish = (payload, exitCode = 0) => {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
};

const addCheck = (checks, name, passed, details = {}) => {
  checks.push({ name, passed: Boolean(passed), ...details });
};

const assertNoError = (label, result) => {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const normalizeMoney = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
};

const mpGetJson = async (apiPath, token) => {
  const response = await fetch(`https://api.mercadopago.com${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Mercado Pago ${apiPath} respondió ${response.status}`);
  }
  return data;
};

const findOrderByEmailAndSku = async (supabase, email, productId) => {
  const orders = assertNoError('orders by email', await supabase
    .from('orders')
    .select('id, created_at')
    .ilike('customer_email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20));

  if (!orders?.length) return null;

  const orderIds = orders.map((order) => order.id);
  const items = assertNoError('order items by email', await supabase
    .from('order_items')
    .select('order_id, product_id')
    .in('order_id', orderIds)
    .eq('product_id', productId));

  const matchingOrderIds = new Set((items || []).map((item) => item.order_id));
  return orders.find((order) => matchingOrderIds.has(order.id))?.id || null;
};

const fetchOrderBundle = async (supabase, orderId) => {
  const [order, items, payments, claims, directCards, linkedCards] = await Promise.all([
    supabase
      .from('orders')
      .select('id, folio, customer_name, customer_email, customer_phone, payment_method, payment_status, fulfillment_status, amount_cents, currency, mp_payment_id, paid_at, created_at, updated_at, deleted_at, is_test, test_reason')
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, unit_price_cents')
      .eq('order_id', orderId),
    supabase
      .from('payments')
      .select('id, order_id, provider, status, amount_cents, currency, external_id, deleted_at, created_at, updated_at')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('profile_claims')
      .select('id, order_id, card_id, customer_email, status, claimed_by_user_id, claimed_profile_id, quantity, created_at, updated_at')
      .eq('order_id', orderId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('cards')
      .select('id, order_id, profile_id, card_code, status, activation_status, nfc_url, deleted_at')
      .eq('order_id', orderId)
      .is('deleted_at', null),
    supabase
      .from('order_cards')
      .select('order_id, card_id, cards(id, order_id, profile_id, card_code, status, activation_status, nfc_url, deleted_at)')
      .eq('order_id', orderId),
  ]);

  return {
    order: assertNoError('order', order),
    items: assertNoError('order_items', items) || [],
    payments: assertNoError('payments', payments) || [],
    claims: assertNoError('profile_claims', claims) || [],
    cards: [
      ...(assertNoError('cards', directCards) || []),
      ...((assertNoError('order_cards', linkedCards) || []).map((row) => row.cards).filter(Boolean)),
    ],
  };
};

const pickProfileId = ({ claims, cards }) => {
  const claimed = claims.find((claim) => claim.claimed_profile_id)?.claimed_profile_id;
  if (claimed) return { profileId: claimed, source: 'profile_claims.claimed_profile_id' };
  const cardProfile = cards.find((card) => card.profile_id)?.profile_id;
  if (cardProfile) return { profileId: cardProfile, source: 'cards.profile_id' };
  return { profileId: null, source: null };
};

const fetchProfile = async (supabase, { profileId, email }) => {
  if (profileId) {
    const byId = assertNoError('profile by id', await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle());
    if (byId) return { profile: byId, source: 'linked_profile' };
  }

  if (!email) return { profile: null, source: null };
  const byEmail = assertNoError('profile by email', await supabase
    .from('profiles')
    .select('*')
    .ilike('contact_email', email)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle());
  return { profile: byEmail || null, source: byEmail ? 'profiles.contact_email' : null };
};

const detectDemoData = (profile) => {
  if (!profile) return [];
  const text = Object.entries(profile)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `${key}:${value}`)
    .join('\n')
    .toLowerCase();
  return DEMO_NEEDLES.filter((needle) => text.includes(needle.toLowerCase()));
};

const getSlugCount = async (supabase, slug) => {
  if (!slug) return 0;
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
    .is('deleted_at', null);
  if (error) throw new Error(`slug count: ${error.message}`);
  return count || 0;
};

const deriveKanbanLane = (order, { payments, cards, claims }) => {
  const activePayments = (payments || []).filter((payment) => !payment.deleted_at);
  const paymentStatuses = Array.from(new Set(activePayments.map((payment) => payment.status).filter(Boolean)));
  const derivedPaymentStatus = ['refunded', 'paid', 'pending', 'authorized', 'failed'].find((status) => paymentStatuses.includes(status)) || null;
  const paymentDrift = Boolean(derivedPaymentStatus) && (derivedPaymentStatus === 'authorized' ? 'pending' : derivedPaymentStatus) !== order.payment_status;
  const claim = claims[0] || null;
  const activationCompleted = Boolean(order.paid_at && claim?.status === 'claimed')
    || cards.some((card) => card.status === 'active' || card.activation_status === 'activated');
  const programmedCards = cards.filter((card) => card.nfc_url || card.activation_status === 'assigned').length;
  const alerts = [];

  if (paymentDrift) alerts.push('payment_drift');
  if (order.payment_status === 'paid' && order.fulfillment_status === 'new') {
    const paidMs = new Date(order.paid_at || order.updated_at || order.created_at).getTime();
    if (!Number.isNaN(paidMs) && (Date.now() - paidMs) / (1000 * 60 * 60) > 24) alerts.push('paid_new_aging');
  }
  if (['ready', 'shipped', 'delivered'].includes(order.fulfillment_status) && cards.length === 0) alerts.push('advanced_without_card');
  if (order.fulfillment_status === 'delivered' && !activationCompleted) alerts.push('delivered_without_activation');

  if (alerts.length > 0) return { visible: true, lane: 'alerts', alerts, programmed_cards_count: programmedCards };
  if (order.payment_status === 'paid' && order.fulfillment_status === 'new') return { visible: true, lane: 'paid_new', alerts, programmed_cards_count: programmedCards };
  if (order.payment_status === 'paid' && order.fulfillment_status === 'in_production') return { visible: true, lane: 'in_production', alerts, programmed_cards_count: programmedCards };
  if (order.payment_status === 'paid' && order.fulfillment_status === 'ready') return { visible: true, lane: 'ready_to_ship', alerts, programmed_cards_count: programmedCards };
  if (order.fulfillment_status === 'shipped') return { visible: true, lane: 'shipped_pending_delivery', alerts, programmed_cards_count: programmedCards };
  if (order.fulfillment_status === 'delivered') return { visible: true, lane: 'delivered', alerts, programmed_cards_count: programmedCards };
  return { visible: false, lane: null, alerts, programmed_cards_count: programmedCards };
};

const main = async () => {
  if (hasFlag('help')) {
    printUsage();
    return;
  }

  const orderIdArg = argValue('order-id');
  const emailArg = normalizeEmail(argValue('email'));
  const sku = argValue('sku') || DEFAULT_SKU;

  if (!orderIdArg && !emailArg) {
    printUsage();
    finish({ success: false, error: 'Debes indicar --order-id=<uuid> o --email=<correo>' }, 1);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const mpToken = process.env.MP_ACCESS_TOKEN;

  if (!supabaseUrl || !serviceKey) {
    finish({ success: false, error: 'Faltan SUPABASE_URL/SERVICE_ROLE_KEY o REACT_APP_SUPABASE_URL/SUPABASE_SERVICE_KEY' }, 1);
  }
  if (!mpToken) {
    finish({ success: false, error: 'Falta MP_ACCESS_TOKEN para validar Mercado Pago' }, 1);
  }

  const checks = [];
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const product = assertNoError('product', await supabase
    .from('products')
    .select('id, sku, name, price_cents, status')
    .eq('sku', sku)
    .maybeSingle());

  addCheck(checks, 'product_active', product?.status === 'active', {
    sku,
    price_cents: product?.price_cents ?? null,
    expected_amount_cents: EXPECTED_AMOUNT_CENTS,
  });

  const orderId = orderIdArg || await findOrderByEmailAndSku(supabase, emailArg, product?.id);
  if (!orderId) {
    finish({ success: false, sku, email: emailArg || null, checks, error: 'No se encontró una orden para los filtros indicados' }, 1);
  }

  const bundle = await fetchOrderBundle(supabase, orderId);
  const { order, items, payments, claims, cards } = bundle;
  if (!order) {
    finish({ success: false, sku, order_id: orderId, checks, error: 'No se encontró la orden indicada' }, 1);
  }

  addCheck(checks, 'order_exists', !!order && !order.deleted_at, { order_id: orderId, folio: order?.folio || null });
  addCheck(checks, 'order_amount_is_1000_clp', normalizeMoney(order?.amount_cents) === EXPECTED_AMOUNT_CENTS && (order?.currency || 'CLP') === 'CLP', {
    amount_cents: order?.amount_cents ?? null,
    currency: order?.currency || null,
  });

  const matchingItems = items.filter((item) => item.product_id === product?.id);
  addCheck(checks, 'order_has_test_sku', matchingItems.length > 0, {
    sku,
    quantity: matchingItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  });
  addCheck(checks, 'order_mp_payment_id_present', !!order?.mp_payment_id, {
    mp_payment_id_present: Boolean(order?.mp_payment_id),
  });

  let mpPayment = null;
  if (order?.mp_payment_id) {
    mpPayment = await mpGetJson(`/v1/payments/${encodeURIComponent(order.mp_payment_id)}`, mpToken);
  } else {
    const search = await mpGetJson(`/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=5`, mpToken);
    mpPayment = (search?.results || []).find((payment) => payment?.status === 'approved' && payment?.id) || null;
  }

  addCheck(checks, 'mercado_pago_approved', mpPayment?.status === 'approved', {
    status: mpPayment?.status || null,
    status_detail: mpPayment?.status_detail || null,
  });
  addCheck(checks, 'mercado_pago_external_reference_matches', mpPayment?.external_reference === orderId, {
    external_reference_matches: mpPayment?.external_reference === orderId,
  });
  addCheck(checks, 'mercado_pago_amount_matches', normalizeMoney(mpPayment?.transaction_amount) === EXPECTED_AMOUNT_CENTS && mpPayment?.currency_id === 'CLP', {
    transaction_amount: mpPayment?.transaction_amount ?? null,
    currency_id: mpPayment?.currency_id || null,
  });

  const paidLedger = payments.find((payment) => payment.provider === 'mercado_pago' && payment.status === 'paid');
  addCheck(checks, 'payment_ledger_exists_paid', !!paidLedger, {
    payment_id: paidLedger?.id || null,
    status: paidLedger?.status || null,
    provider: paidLedger?.provider || null,
  });
  addCheck(checks, 'payment_ledger_external_id_matches', !!paidLedger && String(paidLedger.external_id || '') === String(order.mp_payment_id || mpPayment?.id || ''), {
    external_id_matches: !!paidLedger && String(paidLedger.external_id || '') === String(order.mp_payment_id || mpPayment?.id || ''),
  });

  const { profileId, source: profileIdSource } = pickProfileId({ claims, cards });
  const { profile, source: profileSource } = await fetchProfile(supabase, { profileId, email: order.customer_email });
  const demoHits = detectDemoData(profile);
  const slugCount = await getSlugCount(supabase, profile?.slug);

  addCheck(checks, 'profile_exists', !!profile && !profile.deleted_at, {
    profile_id: profile?.id || null,
    source: profileIdSource || profileSource,
  });
  addCheck(checks, 'profile_has_no_demo_data', demoHits.length === 0, { demo_hits: demoHits });
  addCheck(checks, 'profile_slug_present', !!profile?.slug, { slug: profile?.slug || null });
  addCheck(checks, 'profile_slug_unique', !!profile?.slug && slugCount === 1, { slug: profile?.slug || null, active_slug_count: slugCount });

  const kanban = order ? deriveKanbanLane(order, { payments, cards, claims }) : { visible: false, lane: null, alerts: [] };
  addCheck(checks, 'order_visible_in_kanban', kanban.visible, {
    lane: kanban.lane,
    alerts: kanban.alerts,
    is_test: order?.is_test || false,
    test_reason: order?.test_reason || null,
  });

  const success = checks.every((check) => check.passed);
  finish({
    success,
    order_id: orderId,
    sku,
    summary: {
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
      kanban_lane: kanban.lane,
      profile_slug: profile?.slug || null,
    },
    checks,
  }, success ? 0 : 1);
};

main().catch((error) => {
  finish({ success: false, error: error instanceof Error ? error.message : String(error) }, 1);
});
