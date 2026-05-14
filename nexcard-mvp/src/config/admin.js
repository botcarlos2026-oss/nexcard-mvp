export const ADMIN_EMAILS = [
  'bot.carlos.2026@gmail.com',
  'carlos.alvarez.contreras@gmail.com',
  // 'carlos@nexcard.com', // activar cuando el dominio esté operativo
];

export const isAdminEmail = (email) => {
  const normalized = email?.toLowerCase?.().trim?.();
  return !!normalized && ADMIN_EMAILS.includes(normalized);
};

export const ADMIN_ROUTES = new Set([
  '/admin',
  '/admin/inventory',
  '/admin/cards',
  '/admin/profiles',
  '/admin/orders',
  '/admin/orders/qa',
  '/admin/crm',
  '/admin/nexreview',
  '/admin/emails',
  '/admin/review-cards',
  '/admin/products',
  '/admin/print-test',
  '/admin/team',
  '/admin/wheel',
]);

export const KPI_SLA_TARGET_HOURS = {
  paid_to_ready: 24,
  ready_to_shipped: 24,
  shipped_to_delivered: 72,
  delivered_to_activated: 24,
};

export const KPI_PAYMENT_METHOD_FEES = {
  webpay: 0.0295,
  transbank: 0.0295,
  mercado_pago: 0.0349,
  'mercado-pago': 0.0349,
  default: 0,
};

export const KPI_WOW_ALERT_THRESHOLDS = {
  revenue_drop_pct: -20,
  payment_rate_drop_pts: -8,
  carrier_delivery_rate_drop_pts: -10,
  sku_claim_rate_pct: 8,
};
