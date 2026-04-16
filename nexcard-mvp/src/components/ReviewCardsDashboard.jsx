import React, { useEffect, useState } from 'react';
import { Copy, CheckCircle, ExternalLink, ToggleLeft, ToggleRight, Pencil, X, Check } from 'lucide-react';
import { api } from '../services/api';

const NAV = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Cards', href: '/admin/cards' },
  { label: 'Profiles', href: '/admin/profiles' },
  { label: 'Inventario', href: '/admin/inventory' },
  { label: 'Review Cards', href: '/admin/review-cards' },
];

function toSlug(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function isValidGoogleUrl(url) {
  return url.includes('google') || url.includes('maps.app.goo.gl') || url.includes('goo.gl');
}

export default function ReviewCardsDashboard() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  // Form state
  const [form, setForm] = useState({
    order_id: '',
    customer_email: '',
    business_name: '',
    google_review_url: '',
    slug: '',
  });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getReviewCards()
      .then(setCards)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const reload = () => api.getReviewCards().then(setCards).catch(() => {});

  const copyLink = (slug) => {
    navigator.clipboard.writeText(`https://nexcard.cl/r/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggle = async (card) => {
    await api.updateReviewCard(card.id, { active: !card.active });
    reload();
  };

  const handleSaveUrl = async (id) => {
    if (!isValidGoogleUrl(editUrl)) {
      return;
    }
    setSaving(true);
    await api.updateReviewCard(id, { google_review_url: editUrl });
    setSaving(false);
    setEditingId(null);
    reload();
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'business_name') next.slug = toSlug(value);
      return next;
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.customer_email || !form.business_name || !form.google_review_url || !form.slug) {
      setFormError('Todos los campos obligatorios son requeridos.');
      return;
    }
    if (!isValidGoogleUrl(form.google_review_url)) {
      setFormError('La URL debe ser un enlace de Google Reviews o Google Maps.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        customer_email: form.customer_email,
        business_name: form.business_name,
        google_review_url: form.google_review_url,
        slug: form.slug,
        ...(form.order_id ? { order_id: form.order_id } : {}),
      };
      const newCard = await api.createReviewCard(payload);
      setCreated(newCard);
      setForm({ order_id: '', customer_email: '', business_name: '', google_review_url: '', slug: '' });
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Stats
  const activeCount = cards.filter((c) => c.active).length;
  const totalScans = cards.reduce((acc, c) => acc + (c.scan_count || 0), 0);
  const topCard = cards.reduce((top, c) => (!top || c.scan_count > top.scan_count ? c : top), null);

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const labelClass = 'text-xs text-zinc-400 font-semibold uppercase tracking-wide mb-1 block';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex gap-2 flex-wrap">
        {NAV.map(({ label, href }) => (
          <a
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              href === '/admin/review-cards'
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <h1 className="text-2xl font-black">Google Reviews Cards</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Cards activas</p>
            <p className="text-3xl font-black text-emerald-400">{activeCount}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Total scans</p>
            <p className="text-3xl font-black text-white">{totalScans}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Más escaneada</p>
            <p className="text-lg font-bold text-white truncate">{topCard ? topCard.business_name : '—'}</p>
            {topCard && <p className="text-sm text-zinc-400">{topCard.scan_count} scans</p>}
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <p className="font-bold text-sm">Review Cards registradas</p>
          </div>
          {loading ? (
            <p className="p-6 text-zinc-500 text-sm">Cargando…</p>
          ) : error ? (
            <p className="p-6 text-red-400 text-sm">{error}</p>
          ) : cards.length === 0 ? (
            <p className="p-6 text-zinc-500 text-sm">No hay review cards aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Negocio</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Slug</th>
                    <th className="text-left px-4 py-3">URL Google</th>
                    <th className="text-center px-4 py-3">Scans</th>
                    <th className="text-center px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr key={card.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium">{card.business_name}</td>
                      <td className="px-4 py-3 text-zinc-400">{card.customer_email}</td>
                      <td className="px-4 py-3">
                        <code className="text-emerald-400 text-xs">/r/{card.slug}</code>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {editingId === card.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              className="flex-1 bg-zinc-800 border border-zinc-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button onClick={() => handleSaveUrl(card.id)} disabled={saving} className="text-emerald-400 hover:text-emerald-300">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs truncate block max-w-[200px]">{card.google_review_url}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{card.scan_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${card.active ? 'bg-emerald-900 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                          {card.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            title="Editar URL"
                            onClick={() => { setEditingId(card.id); setEditUrl(card.google_review_url); }}
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            title="Copiar link"
                            onClick={() => copyLink(card.slug)}
                            className="text-zinc-400 hover:text-emerald-400 transition-colors"
                          >
                            {copied === card.slug ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                          <a
                            href={`/r/${card.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir link"
                            className="text-zinc-400 hover:text-white transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            title={card.active ? 'Desactivar' : 'Activar'}
                            onClick={() => handleToggle(card)}
                            className={`transition-colors ${card.active ? 'text-emerald-400 hover:text-red-400' : 'text-zinc-600 hover:text-emerald-400'}`}
                          >
                            {card.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Crear nueva */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <p className="font-bold text-sm mb-4">Crear nueva Review Card</p>

          {created && (
            <div className="mb-4 p-4 bg-emerald-900/40 border border-emerald-700 rounded-xl">
              <p className="text-emerald-300 font-semibold text-sm mb-1">Review Card creada</p>
              <div className="flex items-center gap-2">
                <code className="text-emerald-400 text-sm">https://nexcard.cl/r/{created.slug}</code>
                <button onClick={() => copyLink(created.slug)} className="text-zinc-400 hover:text-emerald-400">
                  {copied === created.slug ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-zinc-400 text-xs mt-2">Programa este link en la tarjeta NFC del cliente.</p>
              <button onClick={() => setCreated(null)} className="mt-2 text-xs text-zinc-500 hover:text-white underline">Cerrar</button>
            </div>
          )}

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Order ID <span className="text-zinc-600 font-normal">(opcional)</span></label>
              <input name="order_id" value={form.order_id} onChange={handleFormChange} placeholder="UUID de la orden" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email del cliente *</label>
              <input name="customer_email" type="email" value={form.customer_email} onChange={handleFormChange} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Nombre del negocio *</label>
              <input name="business_name" value={form.business_name} onChange={handleFormChange} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Slug *</label>
              <div className="flex items-center gap-2">
                <input name="slug" value={form.slug} onChange={handleFormChange} required className={inputClass} />
              </div>
              {form.slug && (
                <p className="text-xs text-zinc-500 mt-1">nexcard.cl/r/<span className="text-emerald-400">{form.slug}</span></p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>URL de Google Reviews *</label>
              <input
                name="google_review_url"
                value={form.google_review_url}
                onChange={handleFormChange}
                required
                placeholder="https://search.google.com/local/writereview?placeid=... o https://maps.app.goo.gl/..."
                className={inputClass}
              />
            </div>

            {formError && <p className="sm:col-span-2 text-red-400 text-sm">{formError}</p>}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                {creating ? 'Creando…' : 'Crear Review Card'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
