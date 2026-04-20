import React, { useEffect, useState } from 'react';
import { Copy, CheckCircle, ExternalLink, ToggleLeft, ToggleRight, Pencil, X, Check } from 'lucide-react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminStat from './ui/AdminStat';
import AdminCard from './ui/AdminCard';
import AdminBadge from './ui/AdminBadge';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';

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

  const inputClass = 'w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors';
  const labelClass = 'block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5';

  return (
    <AdminShell active="reviews" title="Google Reviews Cards">
      <div className="space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminStat label="Cards activas" value={activeCount} accent="emerald" />
          <AdminStat label="Total scans" value={totalScans} />
          <AdminStat
            label="Más escaneada"
            value={topCard ? topCard.business_name : '—'}
            hint={topCard ? `${topCard.scan_count} scans` : undefined}
          />
        </div>

        {/* Tabla */}
        <AdminCard className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <p className="font-bold text-sm text-white">Review Cards registradas</p>
          </div>
          {loading ? (
            <p className="p-6 text-zinc-500 text-sm">Cargando…</p>
          ) : error ? (
            <p className="p-6 text-red-400 text-sm">{error}</p>
          ) : cards.length === 0 ? (
            <p className="p-6 text-zinc-500 text-sm">No hay review cards aún.</p>
          ) : (
            <Table>
              <THead>
                <TH>Negocio</TH>
                <TH>Email</TH>
                <TH>Slug</TH>
                <TH>URL Google</TH>
                <TH className="text-center">Scans</TH>
                <TH className="text-center">Estado</TH>
                <TH>Acciones</TH>
              </THead>
              <tbody>
                {cards.map((card) => (
                  <TR key={card.id}>
                    <TD className="font-medium text-white">{card.business_name}</TD>
                    <TD>{card.customer_email}</TD>
                    <TD>
                      <code className="text-emerald-400 text-xs">/r/{card.slug}</code>
                    </TD>
                    <TD className="max-w-xs">
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
                    </TD>
                    <TD className="text-center font-bold text-white">{card.scan_count}</TD>
                    <TD className="text-center">
                      <AdminBadge variant={card.active ? 'success' : 'default'}>
                        {card.active ? 'Activa' : 'Inactiva'}
                      </AdminBadge>
                    </TD>
                    <TD>
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
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </AdminCard>

        {/* Crear nueva */}
        <AdminCard>
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
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creando…' : 'Crear Review Card'}
              </button>
            </div>
          </form>
        </AdminCard>
      </div>
    </AdminShell>
  );
}
