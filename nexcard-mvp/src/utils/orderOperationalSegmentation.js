export const NON_OPERATIONAL_ORDER_EMAILS = new Set([
  'bot.carlos.2026@gmail.com',
  'carlos.alvarez.contreras@gmail.com',
  'admin@nexcard.cl',
  'carlos@nexcard.cl',
  'hola@nexcard.cl',
]);

export const NON_OPERATIONAL_ORDER_NAME_REGEX = /\b(qa|test|tst|smoke|demo|bot)\b/i;

export const deriveOrderTestClassification = (order) => {
  if (order?.is_test === true) {
    return { isTest: true, reason: order?.test_reason || 'explicit_flag' };
  }

  const email = String(order?.customer_email || '').trim().toLowerCase();
  const name = String(order?.customer_name || order?.customerLabel || '').trim();

  if (NON_OPERATIONAL_ORDER_EMAILS.has(email)) {
    return { isTest: true, reason: 'internal_email_fallback' };
  }
  if (email.endsWith('@nexcard.cl')) {
    return { isTest: true, reason: 'internal_domain_fallback' };
  }
  if (NON_OPERATIONAL_ORDER_NAME_REGEX.test(name)) {
    return { isTest: true, reason: 'name_pattern_fallback' };
  }

  return { isTest: false, reason: null };
};

export const isNonOperationalOrder = (order) => deriveOrderTestClassification(order).isTest;

export const isManualTestReason = (reason) => typeof reason === 'string' && reason.startsWith('manual_admin_override');
