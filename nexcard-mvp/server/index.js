const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');

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
