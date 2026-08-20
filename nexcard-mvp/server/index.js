const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_SERVER !== 'true') {
  console.error('server/index.js no debe correr en producción');
  process.exit(1);
}

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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.PUBLIC_APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-user-id', 'x-nexcard-local-admin'],
  credentials: false,
}));
app.use(express.json({ limit: '2mb' }));

const allowInsecureLocalAuth = process.env.NEXCARD_ALLOW_INSECURE_LOCAL_AUTH === 'true';
const localAdminSecret = process.env.NEXCARD_LOCAL_ADMIN_SECRET || '';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();
const PROFILE_ALLOWED_FIELDS = new Set([
  'slug', 'full_name', 'profession', 'bio', 'avatar_url', 'theme_color', 'is_dark_mode',
  'whatsapp', 'instagram', 'linkedin', 'website', 'vcard_enabled', 'calendar_url',
  'bank_enabled', 'bank_name', 'bank_type', 'bank_number', 'bank_rut', 'bank_email',
  'account_type', 'company', 'contact_email', 'contact_phone', 'location', 'cover_image_url',
  'facebook', 'facebook_enabled', 'instagram_enabled', 'linkedin_enabled',
  'contact_email_enabled', 'contact_phone_enabled', 'website_enabled', 'whatsapp_enabled',
  'portfolio_enabled', 'portfolio_url', 'calendar_url_enabled', 'tiktok', 'tiktok_enabled',
  'review_url', 'card_type',
]);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, intenta más tarde' },
});

function getBearerToken(req) {
  const authHeader = req.header('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : '';
}

function pruneExpiredSessions(now = Date.now()) {
  for (const [token, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) sessions.delete(token);
  }
}

function createLocalSession(userId) {
  pruneExpiredSessions();
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getLocalSessionUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  pruneExpiredSessions();
  const session = sessions.get(token);
  if (!session) return null;
  const db = readDb();
  const user = db.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    sessions.delete(token);
    return null;
  }
  return user;
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifyPassword(password, user) {
  if (!user) return false;
  if (user.password_hash) {
    const [scheme, salt, storedHash] = String(user.password_hash).split(':');
    if (scheme !== 'scrypt' || !salt || !storedHash) return false;
    const candidate = Buffer.from(scryptSync(String(password), salt, 64).toString('hex'), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }
  return typeof user.password === 'string' && safeEqual(password, user.password);
}

function sanitizeStoredUser(user) {
  if (!user) return user;
  const { password: _password, password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

async function requireVerifiedUser(req, res, next) {
  const bearer = getBearerToken(req);

  const localUser = getLocalSessionUser(req);
  if (localUser) {
    req.verifiedUser = sanitizeStoredUser(localUser);
    return next();
  }

  if (supabase && bearer) {
    try {
      const { data, error } = await supabase.auth.getUser(bearer);
      if (!error && data?.user?.id) {
        req.verifiedUser = data.user;
        return next();
      }
    } catch {
      // fall through to fail-closed response below
    }
  }

  if (allowInsecureLocalAuth && req.header('x-user-id')) {
    req.verifiedUser = { id: req.header('x-user-id'), source: 'explicit_insecure_local_auth' };
    return next();
  }

  return res.status(401).json({ error: 'Authorization requerida' });
}

async function requireAdmin(req, res, next) {
  const bearer = getBearerToken(req);

  const localUser = getLocalSessionUser(req);
  if (localUser) {
    if (localUser.role === 'admin') return next();
    return res.status(403).json({ error: 'Acceso admin requerido' });
  }

  if (supabase && bearer) {
    try {
      const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: isAdmin, error } = await caller.rpc('has_role', { required_role: 'admin' });
      if (!error && isAdmin) return next();
    } catch {
      // fall through to fail-closed response below
    }
  }

  if (localAdminSecret && safeEqual(req.header('x-nexcard-local-admin') || '', localAdminSecret)) {
    return next();
  }
  return res.status(403).json({ error: 'Acceso admin requerido' });
}

function buildMinimalSeed() {
  return {
    users: [],
    profiles: [],
    profile_claims: [],
    profile_slug_reservations: [],
    products: [],
    orders: [],
    inventory: [],
    cards: [],
    card_events: [],
    card_scans: [],
    content: {
      landing: {},
    },
  };
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(SEED_FILE)) {
      fs.copyFileSync(SEED_FILE, DB_FILE);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(buildMinimalSeed(), null, 2));
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

function ensureSmokeFixtures(db) {
  let changed = false;
  db.users = db.users || [];
  db.profiles = db.profiles || [];
  db.profile_claims = db.profile_claims || [];
  db.profile_slug_reservations = db.profile_slug_reservations || [];
  db.content = db.content || { landing: {} };
  db.content.landing = db.content.landing || {};

  if (!process.env.NEXCARD_LOCAL_ADMIN_PASSWORD) {
    console.warn(
      'NEXCARD_LOCAL_ADMIN_PASSWORD no está seteada — se omite la creación del admin de smoke tests (admin@nexcard.local). Setea la variable para habilitarlo.'
    );
  } else {
    const adminUser = {
      id: 'user-admin-e2e-local',
      email: 'admin@nexcard.local',
      password_hash: hashPassword(process.env.NEXCARD_LOCAL_ADMIN_PASSWORD),
      role: 'admin',
    };

    if (!db.users.some((user) => user.email === adminUser.email)) {
      db.users.push(adminUser);
      changed = true;
    }
  }

  const smokeProfile = {
    id: 'profile-qa-smoke',
    user_id: 'user-qa-smoke',
    slug: 'qa-smoke-profile',
    full_name: 'QA Smoke Profile',
    profession: 'Perfil público determinístico para smoke',
    bio: 'Fixture local estable para verificar rutas públicas de NexCard.',
    company: 'NexCard QA',
    contact_email: 'qa-smoke@nexcard.local',
    whatsapp: '56911112222',
    whatsapp_enabled: true,
    website: 'https://nexcard.cl',
    website_enabled: true,
    vcard_enabled: true,
    theme_color: '#10B981',
    is_dark_mode: true,
    account_type: 'company',
    status: 'active',
    deleted_at: null,
    view_count: 0,
  };

  if (!db.profiles.some((profile) => profile.slug === smokeProfile.slug && profile.deleted_at == null)) {
    db.profiles.push(smokeProfile);
    changed = true;
  }

  return changed;
}

function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (ensureLifecycleFixtures(db)) {
    writeDb(db);
  }
  if (ensureSmokeFixtures(db)) {
    writeDb(db);
  }
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sanitizeUser(user) {
  if (!user) return null;
  return sanitizeStoredUser(user);
}

function getPublicProfileUrl(slug) {
  if (!slug) return PUBLIC_APP_URL;
  return `${PUBLIC_APP_URL.replace(/\/$/, '')}/${slug}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'nexcard-local-api', timestamp: new Date().toISOString() });
});

app.get('/api/products', (_req, res) => {
  const db = readDb();
  const products = (db.products || []).filter((product) => product.status === 'active');
  res.json(products);
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = db.users.find((candidate) => String(candidate.email || '').trim().toLowerCase() === normalizedEmail);

  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  if (!user.password_hash && user.password) {
    user.password_hash = hashPassword(password);
    delete user.password;
    writeDb(db);
  }

  const profile = db.profiles.find(p => p.user_id === user.id) || null;
  return res.json({ user: sanitizeUser(user), profile, token: createLocalSession(user.id) });
});

app.get('/api/public/profiles/:slug', (req, res) => {
  const db = readDb();
  const profile = db.profiles.find(p => p.slug === req.params.slug && p.status === 'active');

  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

  profile.view_count = (profile.view_count || 0) + 1;
  writeDb(db);
  return res.json(profile);
});

app.post('/api/profile-slugs/availability', (req, res) => {
  const candidateSlug = String(req.body?.candidate_slug || '').trim().toLowerCase();
  const currentOrderId = req.body?.current_order_id || null;
  const db = readDb();
  const normalized = candidateSlug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(normalized)) {
    return res.json({
      available: false,
      slug: normalized,
      reason: 'invalid_format',
      message: 'Usa 3-40 caracteres: letras, números y guiones.',
    });
  }

  const existingProfile = db.profiles.find((profile) => profile.slug === normalized && profile.deleted_at == null);
  if (existingProfile) {
    return res.json({
      available: false,
      slug: normalized,
      reason: 'profile_exists',
      message: 'Ese usuario ya está ocupado. Prueba otro.',
    });
  }

  const activeReservation = (db.profile_slug_reservations || []).find((reservation) => {
    if (reservation.slug !== normalized) return false;
    if (reservation.status !== 'reserved') return false;
    if (!reservation.expires_at || new Date(reservation.expires_at).getTime() <= Date.now()) return false;
    if (!currentOrderId) return true;
    return reservation.order_id !== currentOrderId;
  });

  if (activeReservation) {
    return res.json({
      available: false,
      slug: normalized,
      reason: 'reserved',
      message: 'Ese usuario está reservado por otra compra. Prueba otro.',
    });
  }

  return res.json({
    available: true,
    slug: normalized,
    reason: 'available',
    message: 'Usuario disponible.',
  });
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

app.get('/api/me/profile', requireVerifiedUser, (req, res) => {
  const userId = req.verifiedUser.id;
  const db = readDb();
  const profile = db.profiles.find(p => p.user_id === userId);
  if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
  res.json(profile);
});

app.put('/api/me/profile', requireVerifiedUser, (req, res) => {
  const userId = req.verifiedUser.id;
  const db = readDb();
  const index = db.profiles.findIndex(p => p.user_id === userId);
  if (index === -1) return res.status(404).json({ error: 'Perfil no encontrado' });

  const patch = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key, value]) => PROFILE_ALLOWED_FIELDS.has(key) && value !== undefined)
  );

  db.profiles[index] = {
    ...db.profiles[index],
    ...patch,
    user_id: userId,
  };

  writeDb(db);
  res.json(db.profiles[index]);
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
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

app.get('/api/admin/cards', requireAdmin, (_req, res) => {
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

app.get('/api/admin/inventory', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({ items: db.inventory });
});

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json({ orders: db.orders, products: db.products });
});

app.post('/api/admin/orders', requireAdmin, (req, res) => {
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

app.get('/api/admin/content/landing', requireAdmin, (_req, res) => {
  const db = readDb();
  res.json(db.content.landing);
});

app.put('/api/admin/content/landing', requireAdmin, (req, res) => {
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

app.use((err, _req, res, _next) => {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
});

ensureDb();
app.listen(PORT, () => {
  console.log(`NexCard local API running on http://localhost:${PORT}`);
});
