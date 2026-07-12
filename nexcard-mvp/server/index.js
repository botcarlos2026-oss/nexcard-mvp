const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || process.env.REACT_APP_PUBLIC_APP_URL || 'http://localhost:3000';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function createFallbackDb() {
  return {
    users: [{
      id: 'user-admin-local',
      email: 'admin@nexcard.local',
      password: 'nexcard-local-admin',
      name: 'Admin NexCard',
    }],
    profiles: [{
      id: 'profile-1',
      user_id: 'user-admin-local',
      full_name: 'NexCard Demo',
      profession: 'Perfil comercial de prueba',
      company: 'NexCard',
      location: 'Santiago, Chile',
      bio: 'Perfil local de prueba para validar humo, rutas públicas y NFC sin depender de Supabase.',
      avatar_url: 'https://ui-avatars.com/api/?name=NexCard&background=10B981&color=fff',
      theme_color: '#10B981',
      is_dark_mode: true,
      slug: 'carlos-alvarez',
      status: 'active',
      account_type: 'business',
      vcard_enabled: true,
      whatsapp: '56993183021',
      contact_phone: '+56 9 3183 021',
      contact_email: 'hola@nexcard.cl',
      website_url: 'https://nexcard.cl',
      instagram: 'nexcard.cl',
      view_count: 0,
      bank_enabled: false,
    }],
    products: [{
      id: 'prod-nexcard-basic',
      sku: 'NEXCARD-BASIC',
      name: 'NexCard Digital',
      description: 'Tarjeta NFC con perfil digital editable y soporte de activación.',
      price_cents: 29990,
      currency: 'CLP',
      status: 'active',
      display_order: 1,
    }],
    orders: [{
      id: 'ord-local-1001',
      folio: 'NXC-LOCAL-1001',
      created_at: '2026-07-03T00:00:00.000Z',
      updated_at: '2026-07-03T00:00:00.000Z',
      customer_name: 'Cliente Demo',
      customer_email: 'cliente@nexcard.local',
      customer_phone: '+56 9 1111 1111',
      customer_address: 'Santiago, Chile',
      payment_method: 'mercado-pago',
      payment_status: 'paid',
      fulfillment_status: 'in_production',
      amount_cents: 29990,
      amount: 29990,
      currency: 'CLP',
    }],
    order_items: [{
      id: 'item-local-1001',
      order_id: 'ord-local-1001',
      product_id: 'prod-nexcard-basic',
      quantity: 1,
      unit_price_cents: 29990,
      currency: 'CLP',
    }],
    payments: [],
    cards: [{
      id: 'card-1',
      profile_id: 'profile-1',
      order_id: 'ord-local-1001',
      card_code: 'NXC-LOCAL-001',
      public_token: 'nxc-local-token',
      status: 'active',
      activation_status: 'activated',
      nfc_url: 'http://localhost:4000/c/nxc-local-token',
      created_at: '2026-07-03T00:00:00.000Z',
      updated_at: '2026-07-03T00:00:00.000Z',
      activated_at: '2026-07-03T00:00:00.000Z',
      deleted_at: null,
    }],
    card_events: [],
    card_scans: [],
    inventory: [{
      id: 'inv-card-basic',
      name: 'Tarjeta NFC estándar',
      sku: 'NFC-STANDARD',
      stock: 10,
      unit: 'unidad',
      low_stock_threshold: 3,
    }],
    content: {
      landing: {
        heroTitle: 'Conecta Mejor',
        heroAccent: 'Hoy',
        heroBadge: 'NexCard MVP',
        heroDescription: 'La tarjeta de presentación inteligente que evoluciona con tu negocio.',
        primaryCta: 'Comenzar',
        socialProof: '100+ Profesionales',
        finalCtaTitle: '¿Listo para el siguiente nivel?',
        finalCtaButton: 'Crear mi Tarjeta',
      },
    },
  };
}

app.use(cors({
  origin: process.env.PUBLIC_APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-user-id'],
  credentials: false,
}));
app.use(express.json({ limit: '2mb' }));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(SEED_FILE)) {
      fs.copyFileSync(SEED_FILE, DB_FILE);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(createFallbackDb(), null, 2));
    }
  }
}

function ensureLifecycleFixtures(db) {
  let changed = false;
  db.cards = db.cards || [];
  db.card_events = db.card_events || [];

  const upsertCard = (fixture) => {
    const index = db.cards.findIndex((card) => card.card_code === fixture.card_code);
    if (index >= 0) {
      db.cards[index] = { ...db.cards[index], ...fixture };
    } else {
      db.cards.push(fixture);
    }
    changed = true;
  };

  const ensureEvent = (fixture) => {
    const exists = db.card_events.some((event) => event.card_id === fixture.card_id && event.event_type === fixture.event_type && event.created_at === fixture.created_at);
    if (!exists) {
      db.card_events.push(fixture);
      changed = true;
    }
  };

  if (!db.cards.some((card) => card.card_code === 'NXC-REV-001')) {
    upsertCard({
      id: 'card-4',
      profile_id: 'profile-1',
      order_id: 'ord-1001',
      card_code: 'NXC-REV-001',
      public_token: 'nxc-revoked-token',
      status: 'revoked',
      activation_status: 'revoked',
      created_at: '2026-03-30T10:00:00.000Z',
      updated_at: '2026-04-09T02:13:38.664Z',
      revoked_at: '2026-04-09T02:13:38.664Z',
      deleted_at: null,
    });
  }

  if (!db.cards.some((card) => card.card_code === 'NXC-ARC-001')) {
    upsertCard({
      id: 'card-5',
      profile_id: 'profile-2',
      order_id: 'ord-1002',
      card_code: 'NXC-ARC-001',
      public_token: 'nxc-archived-token',
      status: 'archived',
      activation_status: 'revoked',
      created_at: '2026-03-30T11:00:00.000Z',
      updated_at: '2026-04-09T03:13:38.664Z',
      archived_at: '2026-04-09T03:13:38.664Z',
      deleted_at: '2026-04-09T03:13:38.664Z',
    });
  }

  ensureEvent({ id: 'evt-card-4-revoked', card_id: 'card-4', event_type: 'revoked', created_at: '2026-04-09T02:13:38.664Z' });
  ensureEvent({ id: 'evt-card-5-archived', card_id: 'card-5', event_type: 'archived', created_at: '2026-04-09T03:13:38.664Z' });

  return changed;
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (ensureLifecycleFixtures(db)) {
    writeDb(db);
  }
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function getPublicProfileUrl(slug) {
  if (!slug) return PUBLIC_APP_URL;
  return `${PUBLIC_APP_URL.replace(/\/$/, '')}/${slug}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexcard-local-api', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const user = db.users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const profile = db.profiles.find(p => p.user_id === user.id) || null;
  return res.json({ user: sanitizeUser(user), profile, token: `local-${user.id}` });
});

app.get('/api/public/profiles/:slug', (req, res) => {
  const db = readDb();
  const profile = db.profiles.find(p => p.slug === req.params.slug && p.status === 'active');

  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

  profile.view_count = (profile.view_count || 0) + 1;
  writeDb(db);
  return res.json(profile);
});

app.get('/c/:publicToken', async (req, res) => {
  const unavailableMessage = 'Esta tarjeta fue desactivada. Si necesitas ayuda, contacta soporte.';
  const pendingMessage = 'Esta tarjeta aún no está lista para usarse.';
  const missingMessage = 'Esta tarjeta no existe o ya no está disponible.';

  if (supabase) {
    try {
      const { data: resolvedRows, error: resolveError } = await supabase
        .rpc('resolve_card_by_token', { input_token: req.params.publicToken });

      if (resolveError) throw resolveError;

      const resolved = Array.isArray(resolvedRows) ? resolvedRows[0] : resolvedRows;

      if (!resolved) {
        return res.status(404).send(missingMessage);
      }

      if (['revoked', 'lost', 'archived', 'replaced', 'suspended'].includes(resolved.status)) {
        return res.status(410).send(unavailableMessage);
      }

      if (!resolved.profile_id || !resolved.slug) {
        return res.status(409).send(pendingMessage);
      }

      const { error: scanError } = await supabase
        .from('card_scans')
        .insert({
          card_id: resolved.card_id,
          profile_id: resolved.profile_id,
          organization_id: resolved.organization_id,
          scan_source: 'nfc',
          user_agent: req.header('user-agent') || 'unknown',
          referrer: req.header('referer') || null,
        });

      if (scanError) {
        console.warn('[NFC] card_scans insert failed:', scanError.message);
      }

      return res.redirect(getPublicProfileUrl(resolved.slug));
    } catch (error) {
      console.warn('[NFC] Supabase resolution failed, falling back to local mock:', error.message);
    }
  }

  const db = readDb();
  const cards = db.cards || [];
  const cardScans = db.card_scans || [];
  const card = cards.find(c => c.public_token === req.params.publicToken);

  if (!card) {
    return res.status(404).send(missingMessage);
  }

  if (['revoked', 'lost', 'archived', 'replaced', 'suspended'].includes(card.status)) {
    return res.status(410).send(unavailableMessage);
  }

  if (!card.profile_id) {
    return res.status(409).send(pendingMessage);
  }

  const profile = db.profiles.find(p => p.id === card.profile_id && p.status === 'active');

  if (!profile) {
    return res.status(404).send('El perfil asociado a esta tarjeta no está disponible.');
  }

  cardScans.push({
    id: randomUUID(),
    card_id: card.id,
    profile_id: profile.id,
    created_at: new Date().toISOString(),
    user_agent: req.header('user-agent') || 'unknown',
    scan_source: 'nfc',
  });

  db.card_scans = cardScans;
  writeDb(db);

  return res.redirect(getPublicProfileUrl(profile.slug));
});

app.get('/api/content/landing', (_req, res) => {
  const db = readDb();
  res.json(db.content.landing);
});

app.get('/api/me/profile', (req, res) => {
  const userId = req.header('x-user-id');
  const db = readDb();
  const profile = db.profiles.find(p => p.user_id === userId);
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
  res.json(profile);
});

app.put('/api/me/profile', (req, res) => {
  const userId = req.header('x-user-id');
  const db = readDb();
  const index = db.profiles.findIndex(p => p.user_id === userId);
  if (index === -1) return res.status(404).json({ error: 'Perfil no encontrado' });

  db.profiles[index] = {
    ...db.profiles[index],
    ...req.body,
    user_id: userId,
  };

  writeDb(db);
  res.json(db.profiles[index]);
});

app.get('/api/admin/dashboard', (_req, res) => {
  const db = readDb();
  const totalRevenue = db.orders.reduce((sum, order) => sum + (order.payment_status === 'paid' ? order.amount : 0), 0);
  const totalProfiles = db.profiles.length;
  const totalOrders = db.orders.length;
  const pendingOrders = db.orders.filter(order => order.fulfillment_status !== 'delivered').length;

  res.json({
    stats: {
      totalRevenue,
      totalProfiles,
      totalOrders,
      pendingOrders,
    },
    users: db.profiles.map(profile => ({
      id: profile.id,
      name: profile.full_name,
      slug: profile.slug,
      status: profile.status,
      taps: profile.view_count || 0,
      wa_clicks: Math.round((profile.view_count || 0) * 0.35),
      vcard_clicks: Math.round((profile.view_count || 0) * 0.24),
      color: profile.theme_color || '#10B981',
      account_type: profile.account_type,
    })),
    recentOrders: db.orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
  });
});

app.get('/api/admin/cards', (_req, res) => {
  const db = readDb();
  const profilesById = Object.fromEntries((db.profiles || []).map((profile) => [profile.id, profile]));
  const eventsByCardId = (db.card_events || []).reduce((acc, event) => {
    if (!acc[event.card_id]) acc[event.card_id] = [];
    acc[event.card_id].push(event);
    return acc;
  }, {});

  const cards = (db.cards || []).map((card) => {
    const profile = card.profile_id ? profilesById[card.profile_id] : null;
    const events = (eventsByCardId[card.id] || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return {
      ...card,
      profile_name: profile?.full_name || null,
      profile_slug: profile?.slug || null,
      last_event: events[0] || null,
      events,
    };
  }).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

  res.json({ cards, profiles: db.profiles || [] });
});

app.get('/api/admin/inventory', (_req, res) => {
  const db = readDb();
  res.json({ items: db.inventory });
});

app.get('/api/admin/orders', (_req, res) => {
  const db = readDb();
  res.json({ orders: db.orders, products: db.products });
});

app.post('/api/admin/orders', (req, res) => {
  const db = readDb();
  const order = {
    id: `ord-${Date.now()}`,
    created_at: new Date().toISOString(),
    fulfillment_status: 'new',
    payment_status: 'pending',
    ...req.body,
  };
  db.orders.push(order);
  writeDb(db);
  res.status(201).json(order);
});

app.get('/api/admin/content/landing', (_req, res) => {
  const db = readDb();
  res.json(db.content.landing);
});

app.put('/api/admin/content/landing', (req, res) => {
  const db = readDb();
  db.content.landing = { ...db.content.landing, ...req.body };
  writeDb(db);
  res.json(db.content.landing);
});

app.post('/api/upload/avatar', (req, res) => {
  const { imageUrl } = req.body || {};
  res.json({ url: imageUrl || 'https://via.placeholder.com/256?text=NexCard' });
});

app.post('/api/track', (req, res) => {
  const { slug, buttonType } = req.body || {};
  res.json({ ok: true, slug, buttonType, trackedAt: new Date().toISOString() });
});

ensureDb();
app.listen(PORT, () => {
  console.log(`NexCard local API running on http://localhost:${PORT}`);
});
