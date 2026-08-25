import { SEO_PAGES } from '../components/SeoLandingPage';

const baseUrl = 'https://www.nexcard.cl';

export const buildJsonLdForPath = (path = '/') => {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NexCard',
    url: baseUrl,
    sameAs: ['https://www.instagram.com/nexcard_cl/'],
    contactPoint: [{
      '@type': 'ContactPoint',
      telephone: '+56 9 9318 3021',
      contactType: 'sales',
      areaServed: 'CL',
      availableLanguage: 'Spanish',
    }],
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'NexCard',
    url: baseUrl,
  };

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'NexCard tarjeta digital NFC',
    description: 'Tarjeta NFC premium con perfil digital editable para compartir WhatsApp, redes, web y datos profesionales en un toque.',
    brand: { '@type': 'Brand', name: 'NexCard' },
    offers: [
      { '@type': 'Offer', sku: 'NEXCARD-1', price: '14990', priceCurrency: 'CLP', availability: 'https://schema.org/PreOrder', url: `${baseUrl}/preview#precios` },
      { '@type': 'Offer', sku: 'NEXCARD-3', price: '39990', priceCurrency: 'CLP', availability: 'https://schema.org/PreOrder', url: `${baseUrl}/preview#precios` },
      { '@type': 'Offer', sku: 'NEXCARD-5', price: '59990', priceCurrency: 'CLP', availability: 'https://schema.org/PreOrder', url: `${baseUrl}/preview#precios` },
      { '@type': 'Offer', sku: 'NEXCARD-7', price: '74990', priceCurrency: 'CLP', availability: 'https://schema.org/PreOrder', url: `${baseUrl}/preview#precios` },
    ],
  };

  const seoPage = SEO_PAGES[path];
  if (seoPage) {
    return [organization, product, {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: seoPage.faqs.map(([name, text]) => ({
        '@type': 'Question',
        name,
        acceptedAnswer: { '@type': 'Answer', text },
      })),
    }];
  }

  if (path === '/preview' || path === '/') return [organization, website, product];
  if (path === '/demo') return [organization, { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Demo NexCard', url: `${baseUrl}/demo` }];
  return [organization];
};
