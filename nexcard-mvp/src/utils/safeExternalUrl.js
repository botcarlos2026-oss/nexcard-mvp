const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function safeExternalUrl(value) {
  const raw = (value || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

// Hostname allowlist, not substring matching — `includes('google')` also
// matches `https://evil.example/?google`, which is how review-redirect
// fields turned into an open redirect (see audit H4/H5, 2026-08-25).
const GOOGLE_REVIEW_HOSTNAME_RE = /(^|\.)google\.[a-z.]+$|(^|\.)g\.page$|(^|\.)goo\.gl$/i;

export function isGoogleReviewUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return GOOGLE_REVIEW_HOSTNAME_RE.test(url.hostname);
  } catch {
    return false;
  }
}
