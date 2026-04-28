const SOCIAL_PATTERNS = [
  { name: 'instagram', pattern: /instagram\.com|instagr\.am/i, color: '#E4405F' },
  { name: 'linkedin', pattern: /linkedin\.com|lnkd\.in/i, color: '#0A66C2' },
  { name: 'twitter', pattern: /twitter\.com|x\.com|t\.co/i, color: '#000000' },
  { name: 'tiktok', pattern: /tiktok\.com/i, color: '#000000' },
  { name: 'youtube', pattern: /youtube\.com|youtu\.be/i, color: '#FF0000' },
  { name: 'facebook', pattern: /facebook\.com|fb\.com/i, color: '#1877F2' },
  { name: 'whatsapp', pattern: /wa\.me|whatsapp\.com/i, color: '#25D366' },
  { name: 'telegram', pattern: /t\.me|telegram\.me/i, color: '#26A5E4' },
  { name: 'github', pattern: /github\.com/i, color: '#181717' },
  { name: 'spotify', pattern: /spotify\.com|open\.spotify/i, color: '#1DB954' },
  { name: 'twitch', pattern: /twitch\.tv/i, color: '#9146FF' },
  { name: 'discord', pattern: /discord\.gg|discord\.com/i, color: '#5865F2' },
  { name: 'pinterest', pattern: /pinterest\.com|pin\.it/i, color: '#BD081C' },
  { name: 'medium', pattern: /medium\.com/i, color: '#000000' },
  { name: 'behance', pattern: /behance\.net/i, color: '#1769FF' },
  { name: 'dribbble', pattern: /dribbble\.com/i, color: '#EA4C89' },
  { name: 'calendly', pattern: /calendly\.com/i, color: '#006BFF' },
];

export function detectLinkType(url) {
  if (!url) return { type: 'website', color: '#71717A' };
  const found = SOCIAL_PATTERNS.find(p => p.pattern.test(url));
  if (found) return { type: found.name, color: found.color };
  return { type: 'website', color: '#71717A' };
}

export function getFaviconUrl(url) {
  if (!url) return null;
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const u = new URL(normalized);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch {
    return null;
  }
}

export function getDisplayLabel(url, customLabel) {
  if (customLabel) return customLabel;
  const detected = detectLinkType(url);
  if (detected.type !== 'website') {
    return detected.type.charAt(0).toUpperCase() + detected.type.slice(1);
  }
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const u = new URL(normalized);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}
