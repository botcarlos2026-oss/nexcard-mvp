export const slugify = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

export const isValidProfileSlug = (value = '') => /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(value);

export const PROFILE_SLUG_RULES_MESSAGE = 'Usa 3-40 caracteres: letras, números y guiones. Sin espacios ni símbolos.';
