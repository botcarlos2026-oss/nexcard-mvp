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
  '/admin/crm',
  '/admin/nexreview',
  '/admin/emails',
  '/admin/review-cards',
  '/admin/products',
  '/admin/print-test',
  '/admin/team',
  '/admin/wheel',
]);
