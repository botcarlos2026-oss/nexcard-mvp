/**
 * Google Analytics 4 loader — carga gtag.js de forma diferida y expone
 * trackPageView() para el router manual de App.jsx (no hay react-router).
 */

const GA4_ID = process.env.REACT_APP_GA4_ID || '';

let installed = false;

export const installGa4 = () => {
  if (typeof window === 'undefined' || !GA4_ID || installed) return;
  installed = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);
};

export const trackPageView = (path) => {
  if (typeof window === 'undefined' || !GA4_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

/**
 * Eventos de funnel no-PII. `params` debe llevar solo IDs técnicos o
 * categorías (product_id, order_id, interaction_type) — nunca email,
 * teléfono, nombre, RUT ni slug personal.
 */
export const trackEvent = (name, params = {}) => {
  if (typeof window === 'undefined' || !GA4_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
};
