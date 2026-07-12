#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const cwd = process.cwd();
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const keep = args.includes('--keep');
const countArg = args.find((arg) => arg.startsWith('--count='));
const count = countArg ? Number(countArg.split('=')[1]) : 20;
const productSkuArg = args.find((arg) => arg.startsWith('--sku='));
const productSku = productSkuArg ? productSkuArg.split('=')[1] : 'NEXCARD-MP-TEST-1000';
const runId = `stress-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
const started = Date.now();

const made = {
  orders: [],
  payments: [],
  users: [],
  profiles: [],
  cards: [],
  claims: [],
};

const loadEnvFile = (file) => {
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

loadEnvFile('.env');
loadEnvFile('.env.local');
loadEnvFile('../.env.secrets');
loadEnvFile('../../.env.secrets');
loadEnvFile('/Users/openclow-worker/Documents/business-workspace/.env');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const finish = (payload, exitCode = 0) => {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
};

if (!Number.isInteger(count) || count < 1 || count > 100) {
  finish({ success: false, error: '--count debe ser entero entre 1 y 100' }, 1);
}

if (!supabaseUrl || !serviceKey) {
  finish({ success: false, error: 'Faltan SUPABASE_URL/SERVICE_ROLE_KEY o REACT_APP_SUPABASE_URL/SUPABASE_SERVICE_KEY' }, 1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const assertOk = (label, result) => {
  if (result?.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

const getStressProduct = async () => {
  const result = await supabase
    .from('products')
    .select('id,sku,name,price_cents,status')
    .eq('sku', productSku)
    .eq('status', 'active')
    .single();
  return assertOk('product', result);
};

const createSyntheticPurchase = async (product, index) => {
  const tag = String(index + 1).padStart(2, '0');
  const email = `stress+${runId}-${tag}@nexcard.local`;
  const name = `Stress QA ${tag}`;
  const slug = `stress-${runId}-${tag}`.toLowerCase();
  const now = new Date().toISOString();

  const orderId = assertOk('create_order', await supabase.rpc('create_order_with_items', {
    p_order: {
      customer_name: name,
      customer_email: email,
      customer_phone: `+5699000${tag}${tag}`,
      customer_address: `Av Stress QA ${1000 + index}, Santiago`,
      payment_method: 'mercado-pago',
      currency: 'CLP',
      card_customization: {
        full_name: name,
        template: 'minimal',
        qa_stress_run: runId,
      },
      requires_invoice: false,
    },
    p_items: [{ product_id: product.id, quantity: 1, currency: 'CLP' }],
  }));
  made.orders.push(orderId);

  await supabase
    .from('orders')
    .update({ is_test: true, test_reason: `qa_stress_${runId}` })
    .eq('id', orderId);

  assertOk('transition paid', await supabase.rpc('admin_transition_order_state', {
    target_order_id: orderId,
    next_payment_status: 'paid',
    next_fulfillment_status: null,
    reason: `QA stress paid ${runId}`,
  }));

  const payment = assertOk('payment', await supabase
    .from('payments')
    .insert({
      order_id: orderId,
      provider: 'mercado_pago',
      status: 'paid',
      amount_cents: product.price_cents,
      currency: 'CLP',
      external_id: `qa-stress-${runId}-${tag}`,
      payload: { run_id: runId, synthetic: true },
    })
    .select('id')
    .single());
  made.payments.push(payment.id);

  const userResult = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomBytes(18).toString('base64url'),
    email_confirm: true,
    user_metadata: { qa_stress_run: runId, synthetic: true, name },
  });
  if (userResult.error) throw new Error(`auth.createUser: ${userResult.error.message}`);
  const userId = userResult.data.user.id;
  made.users.push(userId);

  const profile = assertOk('profile', await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      slug,
      full_name: name,
      profession: 'QA Stress Account',
      company: 'NexCard QA',
      contact_email: email,
      contact_phone: `+5699000${tag}${tag}`,
      location: 'Santiago, Chile',
      status: 'active',
      account_type: 'individual',
      theme_color: '#10B981',
      is_dark_mode: true,
      bank_enabled: false,
    })
    .select('id,slug')
    .single());
  made.profiles.push(profile.id);

  const card = assertOk('card', await supabase
    .from('cards')
    .insert({
      profile_id: profile.id,
      order_id: orderId,
      card_code: `QA-${runId.slice(-8).toUpperCase()}-${tag}`,
      public_token: crypto.randomUUID(),
      status: 'active',
      activation_status: 'activated',
      nfc_url: `https://www.nexcard.cl/${slug}`,
      issued_at: now,
      programmed_at: now,
      assigned_at: now,
      activated_at: now,
      metadata: { run_id: runId, synthetic: true },
    })
    .select('id')
    .single());
  made.cards.push(card.id);

  assertOk('order_card', await supabase
    .from('order_cards')
    .insert({ order_id: orderId, card_id: card.id, linked_by: null }));

  const claim = assertOk('claim', await supabase
    .from('profile_claims')
    .insert({
      order_id: orderId,
      card_id: card.id,
      customer_email: email,
      claim_token: crypto.randomUUID(),
      quantity: 1,
      status: 'claimed',
      claimed_by_user_id: userId,
      claimed_profile_id: profile.id,
    })
    .select('id')
    .single());
  made.claims.push(claim.id);

  return { orderId, email, profile: profile.slug, cardId: card.id };
};

const cleanup = async () => {
  const now = new Date().toISOString();
  const steps = [];
  const run = async (label, fn) => {
    try {
      await fn();
      steps.push({ label, ok: true });
    } catch (error) {
      steps.push({ label, ok: false, error: error.message });
    }
  };

  await run('cancel claims', async () => {
    if (!made.claims.length) return;
    const result = await supabase.from('profile_claims').update({ status: 'cancelled' }).in('id', made.claims);
    if (result.error) throw new Error(result.error.message);
  });
  await run('soft delete cards', async () => {
    if (!made.cards.length) return;
    const result = await supabase.from('cards').update({ status: 'archived', deleted_at: now }).in('id', made.cards);
    if (result.error) throw new Error(result.error.message);
  });
  await run('soft delete profiles', async () => {
    if (!made.profiles.length) return;
    const result = await supabase.from('profiles').update({ status: 'pending', deleted_at: now }).in('id', made.profiles);
    if (result.error) throw new Error(result.error.message);
  });
  await run('soft delete payments', async () => {
    if (!made.payments.length) return;
    const result = await supabase.from('payments').update({ deleted_at: now }).in('id', made.payments);
    if (result.error) throw new Error(result.error.message);
  });
  await run('soft delete orders', async () => {
    if (!made.orders.length) return;
    const result = await supabase.from('orders').update({ deleted_at: now }).in('id', made.orders);
    if (result.error) throw new Error(result.error.message);
  });
  for (const userId of made.users) {
    await run(`delete auth ${userId.slice(0, 8)}`, async () => {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    });
  }

  return steps;
};

const countActive = async () => {
  const emptyUuid = '00000000-0000-0000-0000-000000000000';
  const [orders, profiles, cards, claims, controlled] = await Promise.all([
    supabase.from('orders').select('id,payment_status').like('customer_email', `stress+${runId}-%`).is('deleted_at', null),
    supabase.from('profiles').select('id').like('slug', `stress-${runId}-%`).is('deleted_at', null),
    supabase.from('cards').select('id').in('id', made.cards.length ? made.cards : [emptyUuid]).is('deleted_at', null),
    supabase.from('profile_claims').select('id,status').in('id', made.claims.length ? made.claims : [emptyUuid]),
    supabase.from('orders').select('folio,payment_status,deleted_at').eq('folio', 'NX-2026-026').maybeSingle(),
  ]);

  return {
    active_orders: orders.data?.length || 0,
    active_paid_orders: (orders.data || []).filter((order) => order.payment_status === 'paid').length,
    active_profiles: profiles.data?.length || 0,
    active_cards: cards.data?.length || 0,
    claimed_claims: (claims.data || []).filter((claim) => claim.status === 'claimed').length,
    cancelled_claims: (claims.data || []).filter((claim) => claim.status === 'cancelled').length,
    controlled_order_ok: controlled.data?.folio === 'NX-2026-026'
      && controlled.data?.payment_status === 'paid'
      && controlled.data?.deleted_at === null,
  };
};

const product = await getStressProduct();

if (!execute) {
  finish({
    success: true,
    dry_run: true,
    message: 'Dry-run: no se creó data. Agrega --execute para correr la prueba segura con cleanup automático.',
    run_id: runId,
    requested: count,
    product: { sku: product.sku, price_cents: product.price_cents },
    keep,
  });
}

const results = [];
let createError = null;
try {
  for (let index = 0; index < count; index += 1) {
    results.push(await createSyntheticPurchase(product, index));
  }
} catch (error) {
  createError = { step: 'createSyntheticPurchase', error: error.message };
}

const beforeCleanup = await countActive();
const cleanupSteps = keep ? [] : await cleanup();
const afterCleanup = await countActive();
const cleanupOk = keep || cleanupSteps.every((step) => step.ok);
const cleanupInvariantOk = keep || (
  afterCleanup.active_orders === 0
  && afterCleanup.active_profiles === 0
  && afterCleanup.active_cards === 0
  && afterCleanup.claimed_claims === 0
);
const success = !createError && results.length === count && cleanupOk && cleanupInvariantOk && beforeCleanup.controlled_order_ok;

finish({
  success,
  dry_run: false,
  keep,
  run_id: runId,
  requested: count,
  created: results.length,
  create_error: createError,
  product: { sku: product.sku, price_cents: product.price_cents },
  duration_ms: Date.now() - started,
  before_cleanup: beforeCleanup,
  after_cleanup: afterCleanup,
  cleanup_ok: cleanupOk,
  cleanup_invariant_ok: cleanupInvariantOk,
  cleanup_errors: cleanupSteps.filter((step) => !step.ok),
  sample: results.slice(0, 3),
}, success ? 0 : 1);
