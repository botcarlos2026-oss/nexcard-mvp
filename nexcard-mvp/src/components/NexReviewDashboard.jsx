import React, { useMemo, useState } from 'react';
import { Star, Link2, CheckCircle2, AlertCircle, Loader2, Search, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../services/api';
import { supabase } from '../services/supabaseClient';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short' }).format(date);
};

const NexReviewDashboard = ({ profiles = [] }) => {
  const [rows, setRows] = useState(profiles);
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [editingId, setEditingId] = useState(null);
  const [draftUrl, setDraftUrl] = useState('');

  const filtered = useMemo(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((p) =>
      p.slug?.toLowerCase().includes(t) ||
      p.full_name?.toLowerCase().includes(t) ||
      p.review_url?.toLowerCase().includes(t)
    );
  }, [rows, searchTerm]);

  const reviewCards = rows.filter((p) => p.card_type === 'review');
  const nfcCards = rows.filter((p) => p.card_type !== 'review');

  const setFeedbackMsg = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
  };

  const handleToggleType = async (profile) => {
    const newType = profile.card_type === 'review' ? 'nfc' : 'review';
    setBusyId(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ card_type: newType })
        .eq('id', profile.id);
      if (error) throw new Error(error.message);
      setRows((prev) => prev.map((p) => p.id === profile.id ? { ...p, card_type: newType } : p));
      setFeedbackMsg('success', `Perfil /${profile.slug} cambiado a tipo "${newType}".`);
    } catch (err) {
      setFeedbackMsg('error', err.message || 'No se pudo cambiar el tipo.');
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (profile) => {
    setEditingId(profile.id);
    setDraftUrl(profile.review_url || '');
  };

  const handleSaveUrl = async (profile) => {
    if (!draftUrl.trim()) {
      setFeedbackMsg('error', 'La URL no puede estar vacía.');
      return;
    }
    setBusyId(profile.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ review_url: draftUrl.trim(), card_type: 'review' })
        .eq('id', profile.id);
      if (error) throw new Error(error.message);
      setRows((prev) => prev.map((p) =>
        p.id === profile.id ? { ...p, review_url: draftUrl.trim(), card_type: 'review' } : p
      ));
      setFeedbackMsg('success', `URL de reseñas actualizada para /${profile.slug}.`);
      setEditingId(null);
    } catch (err) {
      setFeedbackMsg('error', err.message || 'No se pudo guardar la URL.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-amber-50 rounded-2xl text-amber-500">
                <Star size={22} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-950">NexReview</h1>
            </div>
            <p className="text-zinc-500 font-medium">
              Configura tarjetas NFC que redirigen directamente a tu página de reseñas de Google.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href="/admin" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Dashboard</a>
            <a href="/admin/cards" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Cards</a>
            <a href="/admin/profiles" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Profiles</a>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4 lg:w-fit">
          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm px-6 py-4 flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-500"><Star size={20} /></div>
            <div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">NexReview activos</p>
              <p className="text-2xl font-black text-zinc-950">{reviewCards.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm px-6 py-4 flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-zinc-100 text-zinc-500"><Link2 size={20} /></div>
            <div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Perfiles NFC</p>
              <p className="text-2xl font-black text-zinc-950">{nfcCards.length}</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Cómo funciona */}
        <div className="bg-zinc-950 text-white rounded-[32px] p-6">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">¿Cómo funciona?</p>
          <ol className="space-y-2 text-sm font-medium text-zinc-300">
            <li><span className="font-black text-white">1.</span> Configura la URL de tu página de reseñas de Google Maps.</li>
            <li><span className="font-black text-white">2.</span> Activa el perfil como tipo <span className="text-amber-400 font-black">NexReview</span>.</li>
            <li><span className="font-black text-white">3.</span> Vincula una tarjeta NFC física a ese perfil en el panel Cards.</li>
            <li><span className="font-black text-white">4.</span> Al tocar la tarjeta, el cliente es redirigido directamente a dejar su reseña.</li>
          </ol>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por slug, nombre o URL…"
            className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm font-medium text-zinc-700 shadow-sm outline-none focus:border-zinc-400"
          />
        </div>

        {/* Tabla de perfiles */}
        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100">
            <h2 className="font-semibold text-lg">Todos los perfiles</h2>
            <p className="text-zinc-500 text-sm font-medium">Activa NexReview y configura la URL de reseñas por perfil.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-6 py-4">Perfil</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">URL de reseñas</th>
                  <th className="px-6 py-4">Creado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((profile) => {
                  const isReview = profile.card_type === 'review';
                  const isBusy = busyId === profile.id;
                  const isEditing = editingId === profile.id;

                  return (
                    <tr key={profile.id} className="hover:bg-zinc-50/30 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                            style={{ backgroundColor: profile.theme_color || profile.color || '#10B981' }}>
                            {(profile.full_name || profile.slug || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-sm text-zinc-900">{profile.full_name || profile.slug}</p>
                            <p className="text-xs text-zinc-400">/{profile.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${isReview ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>
                          {isReview ? 'NexReview' : 'NFC'}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={draftUrl}
                              onChange={(e) => setDraftUrl(e.target.value)}
                              placeholder="https://g.page/r/..."
                              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveUrl(profile)}
                              disabled={isBusy}
                              className="shrink-0 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 size={12} className="animate-spin" /> : 'Guardar'}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="shrink-0 px-3 py-2 rounded-xl border border-zinc-200 text-zinc-600 text-xs font-black"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : profile.review_url ? (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500 font-medium truncate max-w-[180px]">{profile.review_url}</p>
                            <a href={profile.review_url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-emerald-500 shrink-0">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-300 font-medium">Sin URL configurada</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500 font-medium">{formatDate(profile.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(profile)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                          >
                            <Link2 size={13} />
                            {profile.review_url ? 'Editar URL' : 'Añadir URL'}
                          </button>
                          <button
                            onClick={() => handleToggleType(profile)}
                            disabled={isBusy || (!profile.review_url && !isReview)}
                            title={!profile.review_url && !isReview ? 'Configura la URL primero' : ''}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isReview ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                          >
                            {isBusy
                              ? <Loader2 size={13} className="animate-spin" />
                              : isReview ? <ToggleRight size={13} /> : <ToggleLeft size={13} />
                            }
                            {isReview ? 'Desactivar' : 'Activar NexReview'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm font-semibold text-zinc-400">
                      No hay perfiles que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NexReviewDashboard;
