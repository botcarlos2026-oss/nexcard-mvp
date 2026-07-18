#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

const root = process.cwd();
['.env', '.env.local', '.env.e2e.local', '.env.secrets', '../.env.secrets', '../../.env.secrets']
  .map((name) => path.resolve(root, name))
  .forEach(loadEnv);

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.log(JSON.stringify({ success: false, error: 'missing_supabase_service_env', has_url: !!supabaseUrl, has_service_role: !!serviceKey }, null, 2));
  process.exit(2);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { data: orders, error: ordersError } = await supabase
  .from('orders')
  .select('*')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .limit(2000);
if (ordersError) throw ordersError;

const [{ data: payments }, { data: claims }, { data: cards }, { data: products }, { data: profiles }] = await Promise.all([
  supabase.from('payments').select('*').limit(5000),
  supabase.from('profile_claims').select('*').limit(5000),
  supabase.from('cards').select('*').is('deleted_at', null).limit(5000),
  supabase.from('products').select('*').limit(500),
  supabase.from('profiles').select('*').is('deleted_at', null).limit(5000),
]);

const byOrder = (rows = []) => rows.reduce((acc, row) => {
  const id = row.order_id;
  if (!id) return acc;
  if (!acc[id]) acc[id] = [];
  acc[id].push(row);
  return acc;
}, {});

const paymentsByOrder = byOrder(payments || []);
const claimsByOrder = byOrder(claims || []);
const cardsByOrder = byOrder(cards || []);
const legacyPaid = (orders || []).filter((order) => order.payment_status === 'paid' && !order.mp_payment_id);
const paidMissingClaim = (orders || []).filter((order) => order.payment_status === 'paid' && !(claimsByOrder[order.id] || []).length);
const paidMissingCards = (orders || []).filter((order) => order.payment_status === 'paid' && !(cardsByOrder[order.id] || []).length);
const activeTestProducts = (products || []).filter((product) => (
  product.status === 'active'
  && (product.sku === 'NEXCARD-MP-TEST-1000' || product.metadata?.test_product === true || product.metadata?.remove_after_validation === true)
));

const slugCounts = {};
for (const profile of profiles || []) {
  if (!profile.slug) continue;
  slugCounts[profile.slug] = (slugCounts[profile.slug] || 0) + 1;
}
const duplicateSlugs = Object.entries(slugCounts).filter(([, count]) => count > 1).map(([slug, count]) => ({ slug, count }));

const summarizeOrder = (order) => ({
  id: order.id,
  folio: order.folio || null,
  created_at: order.created_at,
  amount_cents: order.amount_cents,
  currency: order.currency,
  fulfillment_status: order.fulfillment_status,
  payment_ledgers: (paymentsByOrder[order.id] || []).length,
  claims: (claimsByOrder[order.id] || []).length,
  cards: (cardsByOrder[order.id] || []).length,
  likely_legacy_or_manual: !order.mp_payment_id,
});

console.log(JSON.stringify({
  success: true,
  mode: 'read_only',
  generated_at: new Date().toISOString(),
  summary: {
    orders_scanned: (orders || []).length,
    paid_orders: (orders || []).filter((order) => order.payment_status === 'paid').length,
    paid_without_mp_payment_id: legacyPaid.length,
    paid_missing_claim: paidMissingClaim.length,
    paid_missing_cards: paidMissingCards.length,
    active_test_products: activeTestProducts.length,
    duplicate_active_slugs: duplicateSlugs.length,
  },
  active_test_products: activeTestProducts.map((p) => ({ id: p.id, sku: p.sku, name: p.name, price_cents: p.price_cents, status: p.status })),
  duplicate_active_slugs: duplicateSlugs,
  paid_without_mp_payment_id: legacyPaid.slice(0, 25).map(summarizeOrder),
  paid_missing_claim: paidMissingClaim.slice(0, 25).map(summarizeOrder),
  paid_missing_cards: paidMissingCards.slice(0, 25).map(summarizeOrder),
}, null, 2));
