export const PRICING_COPY_BY_SKU = {
  'NEXCARD-1': {
    homeName: 'Individual',
    catalogName: '1 Tarjeta',
    cards: 1,
    description: '1 tarjeta NexCard para empezar a compartir contacto sin fricción.',
    highlight: false,
    save: 'Pago único',
    cta: 'Comprar Individual',
    features: ['Tarjeta NFC', 'Perfil digital editable', 'Datos de banco y redes', 'QR dinámico'],
  },
  'BASIC-5': {
    homeName: 'Pack Emprendedor',
    catalogName: '3 Tarjetas',
    cards: 3,
    description: 'Para socios, primeras ventas o un equipo pequeño.',
    highlight: false,
    save: 'Ideal para equipo inicial',
    cta: 'Comprar pack',
    features: ['3 tarjetas NFC', '3 perfiles editables', 'Activación guiada', 'Sin mensualidad'],
  },
  'PREMIUM-10': {
    homeName: 'Pack Socios',
    catalogName: '5 Tarjetas',
    cards: 5,
    description: 'Para equipo fundador, ventas o atención comercial.',
    highlight: true,
    badge: 'Recomendado',
    save: 'Mejor equilibrio',
    cta: 'Comprar Pack Socios',
    features: ['5 tarjetas premium', 'Perfil por persona', 'Datos actualizables', 'Ideal para reuniones'],
  },
  'PREMIUM-20': {
    homeName: 'Pack Equipo',
    catalogName: '7 Tarjetas',
    cards: 7,
    description: 'Para equipos comerciales que necesitan presencia consistente.',
    highlight: false,
    save: 'Mejor precio por unidad',
    cta: 'Comprar Equipo',
    features: ['7 tarjetas NFC + QR', 'Onboarding simple', 'Imagen consistente', 'Soporte dedicado'],
  },
};

export const PRICING_SKU_ORDER = ['NEXCARD-1', 'BASIC-5', 'PREMIUM-10', 'PREMIUM-20'];

export const getPricingCopy = (productOrSku) => {
  const sku = typeof productOrSku === 'string' ? productOrSku : productOrSku?.sku;
  return sku ? PRICING_COPY_BY_SKU[sku] || null : null;
};

export const buildPricingPlan = (product = {}, { fallbackCards = 1 } = {}) => {
  const copy = getPricingCopy(product.sku) || {};
  const cards = copy.cards || Number(product.cards) || fallbackCards;

  return {
    ...product,
    ...copy,
    cards,
    price: product.price_cents,
    perUnit: cards ? Math.round((product.price_cents || 0) / cards) : 0,
    features: copy.features || product.features || [],
    name: copy.homeName || product.name || 'NexCard',
    catalogName: copy.catalogName || product.name || copy.homeName || 'NexCard',
    description: copy.description || product.description || 'Tarjeta NFC con perfil digital editable.',
  };
};