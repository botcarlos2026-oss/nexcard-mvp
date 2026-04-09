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

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.copyFileSync(SEED_FILE, DB_FILE);
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
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
