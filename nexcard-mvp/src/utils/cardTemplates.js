// viewBox proporcional a 85.6x54mm (tarjeta CR80 estándar)
export function generateCardSVG(template, data = {}) {
  const {
    name = 'Tu Nombre',
    jobTitle = 'Tu Cargo',
    company = '',
    primaryColor = '#10B981',
  } = data;

  const color = primaryColor || '#10B981';
  const esc = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const watermark = `<text x="330" y="210" text-anchor="end" font-family="sans-serif" font-size="9" opacity="0.4" fill="currentColor">NexCard</text>`;

  if (template === 'dark') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 216">
  <rect width="340" height="216" fill="#09090B" rx="0"/>
  <circle cx="310" cy="32" r="22" fill="${esc(color)}" opacity="0.9"/>
  <text x="24" y="88" font-family="sans-serif" font-size="18" font-weight="700" fill="white">${esc(name)}</text>
  <text x="24" y="112" font-family="sans-serif" font-size="13" fill="#A1A1AA">${esc(jobTitle)}</text>
  ${company ? `<text x="24" y="131" font-family="sans-serif" font-size="12" fill="#71717A">${esc(company)}</text>` : ''}
  <text x="330" y="210" text-anchor="end" font-family="sans-serif" font-size="9" opacity="0.4" fill="white">NexCard</text>
</svg>`;
  }

  if (template === 'corporate') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 216">
  <rect width="340" height="216" fill="#F4F4F5" rx="0"/>
  <rect width="340" height="48" fill="${esc(color)}"/>
  <text x="24" y="102" font-family="sans-serif" font-size="16" font-weight="700" fill="#18181B">${esc(name)}</text>
  <text x="24" y="124" font-family="sans-serif" font-size="13" fill="#52525B">${esc(jobTitle)}</text>
  ${company ? `<text x="24" y="143" font-family="sans-serif" font-size="12" fill="#71717A">${esc(company)}</text>` : ''}
  <text x="330" y="210" text-anchor="end" font-family="sans-serif" font-size="9" opacity="0.4" fill="#18181B">NexCard</text>
</svg>`;
  }

  if (template === 'colorful') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 216">
  <rect width="340" height="216" fill="${esc(color)}" rx="0"/>
  <text x="24" y="96" font-family="sans-serif" font-size="20" font-weight="700" fill="white">${esc(name)}</text>
  <text x="24" y="120" font-family="sans-serif" font-size="14" fill="white" opacity="0.85">${esc(jobTitle)}</text>
  ${company ? `<text x="24" y="140" font-family="sans-serif" font-size="12" fill="white" opacity="0.75">${esc(company)}</text>` : ''}
  <text x="330" y="210" text-anchor="end" font-family="sans-serif" font-size="9" opacity="0.4" fill="white">NexCard</text>
</svg>`;
  }

  // minimal (default)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 216">
  <rect width="340" height="216" fill="white" rx="0"/>
  <rect width="6" height="216" fill="${esc(color)}"/>
  <text x="24" y="96" font-family="sans-serif" font-size="18" font-weight="700" fill="#18181B">${esc(name)}</text>
  <text x="24" y="118" font-family="sans-serif" font-size="13" fill="#71717A">${esc(jobTitle)}</text>
  ${company ? `<text x="24" y="136" font-family="sans-serif" font-size="12" fill="#A1A1AA">${esc(company)}</text>` : ''}
  <text x="330" y="210" text-anchor="end" font-family="sans-serif" font-size="9" opacity="0.4" fill="#18181B">NexCard</text>
</svg>`;
}
