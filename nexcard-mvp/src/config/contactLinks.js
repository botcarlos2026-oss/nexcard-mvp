export const NEXCARD_WHATSAPP_NUMBER = '56993183021';

export const CORPORATE_QUOTE_WHATSAPP_MESSAGE =
  'Hola NexCard, quiero cotizar un plan corporativo para mi empresa. Necesitamos tarjetas para un equipo de ventas/atención/terreno. ¿Me pueden orientar con precios, diseño y tiempos de entrega?';

export const buildWhatsAppUrl = (message = '') => {
  const baseUrl = `https://wa.me/${NEXCARD_WHATSAPP_NUMBER}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
};

export const CORPORATE_QUOTE_WHATSAPP_URL = buildWhatsAppUrl(CORPORATE_QUOTE_WHATSAPP_MESSAGE);
