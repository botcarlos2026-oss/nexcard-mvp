import { isValidProfileSlug, slugify } from './slug';

describe('profile slug helpers', () => {
  it('normalizes names and brands into public slugs', () => {
    expect(slugify('  Café del Mar SpA!!  ')).toBe('cafe-del-mar-spa');
    expect(slugify('Carlos  A---Contreras')).toBe('carlos-a-contreras');
  });

  it('accepts only production-safe public slug format', () => {
    expect(isValidProfileSlug('abc')).toBe(true);
    expect(isValidProfileSlug('mi-marca-2026')).toBe(true);
    expect(isValidProfileSlug('ab')).toBe(false);
    expect(isValidProfileSlug('-mi-marca')).toBe(false);
    expect(isValidProfileSlug('mi-marca-')).toBe(false);
    expect(isValidProfileSlug('mi_marca')).toBe(false);
  });
});
