import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const middlewarePath = path.join(process.cwd(), 'middleware.js');
const { fetchPublicProfileForOg, rewriteOgTagsForProfile } = require(middlewarePath);

describe('middleware public profile lookup', () => {
  it('consulta solo la vista pública con una proyección segura', async () => {
    let requestedUrl;
    const fetchImpl = async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => [{ slug: 'perfil-seguro', full_name: 'Perfil Seguro' }],
      };
    };

    await fetchPublicProfileForOg('perfil-seguro', {
      env: {
        REACT_APP_SUPABASE_URL: 'https://project.supabase.co',
        REACT_APP_SUPABASE_ANON_KEY: 'anon-test-key',
      },
      fetchImpl,
    });

    expect(requestedUrl.pathname).toBe('/rest/v1/profiles_public');
    expect(requestedUrl.pathname).not.toBe('/rest/v1/profiles');
    expect(requestedUrl.searchParams.get('select')).toBe(
      'full_name,profession,bio,avatar_url,cover_image_url,slug'
    );
    expect(requestedUrl.searchParams.get('select')).not.toMatch(/(?:bank_|contact_)/i);
    expect(requestedUrl.searchParams.get('slug')).toBe('eq.perfil-seguro');
    expect(requestedUrl.searchParams.get('status')).toBe('eq.active');
    expect(requestedUrl.searchParams.get('deleted_at')).toBe('is.null');
  });

  it('integra la fila pública con el HTML OG sin requerir columnas sensibles', async () => {
    const publicRow = {
      full_name: 'Estudio Horizonte',
      profession: 'Diseño sustentable',
      bio: 'Creamos espacios responsables para comunidades y equipos.',
      avatar_url: 'https://cdn.example.test/profiles/horizonte.webp',
      cover_image_url: 'https://cdn.example.test/profiles/horizonte-cover.webp',
      slug: 'estudio-horizonte',
    };
    const fetchImpl = async () => ({
      ok: true,
      json: async () => [publicRow],
    });

    const profile = await fetchPublicProfileForOg(publicRow.slug, {
      env: {
        REACT_APP_SUPABASE_URL: 'https://project.supabase.co',
        REACT_APP_SUPABASE_ANON_KEY: 'anon-test-key',
      },
      fetchImpl,
    });
    const sourceHtml = `<!doctype html><html><head>
      <title>NexCard</title>
      <meta property="og:url" content="https://nexcard.cl/">
      <meta property="og:title" content="NexCard">
      <meta property="og:description" content="Tarjeta digital">
      <meta property="og:image" content="https://nexcard.cl/og-image.svg">
      <meta name="twitter:url" content="https://nexcard.cl/">
      <meta name="twitter:title" content="NexCard">
      <meta name="twitter:description" content="Tarjeta digital">
      <meta name="twitter:image" content="https://nexcard.cl/og-image.svg">
    </head><body></body></html>`;

    const response = await rewriteOgTagsForProfile(
      new Response(sourceHtml, { headers: { 'content-type': 'text/html' } }),
      profile,
      publicRow.slug
    );
    const html = await response.text();

    expect(html).toContain('<meta property="og:title" content="Estudio Horizonte — NexCard">');
    expect(html).toContain(
      '<meta property="og:description" content="Creamos espacios responsables para comunidades y equipos.">'
    );
    expect(html).toContain(
      '<meta property="og:image" content="https://cdn.example.test/profiles/horizonte.webp">'
    );
    expect(html).toContain(
      '<meta property="og:url" content="https://nexcard.cl/estudio-horizonte">'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(Object.keys(publicRow).sort()).toEqual(
      ['avatar_url', 'bio', 'cover_image_url', 'full_name', 'profession', 'slug'].sort()
    );
    expect(publicRow).not.toHaveProperty('contact_email');
    expect(publicRow).not.toHaveProperty('bank_number');
  });
});