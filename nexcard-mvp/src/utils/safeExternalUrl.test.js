import { safeExternalUrl } from './safeExternalUrl';

describe('safeExternalUrl', () => {
  it('adds https:// to bare domains', () => {
    expect(safeExternalUrl('calendly.com/carlos')).toBe('https://calendly.com/carlos');
  });

  it('keeps already-valid http(s) URLs untouched', () => {
    expect(safeExternalUrl('https://cal.com/carlos')).toBe('https://cal.com/carlos');
    expect(safeExternalUrl('http://example.com')).toBe('http://example.com/');
  });

  it('blocks javascript: and other dangerous schemes', () => {
    expect(safeExternalUrl('javascript:alert(document.cookie)')).toBe('');
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBe('');
  });

  it('returns empty string for blank/missing input', () => {
    expect(safeExternalUrl('')).toBe('');
    expect(safeExternalUrl(null)).toBe('');
    expect(safeExternalUrl(undefined)).toBe('');
  });
});
