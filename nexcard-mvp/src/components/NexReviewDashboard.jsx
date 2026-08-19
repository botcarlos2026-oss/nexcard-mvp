import React, { useMemo, useState } from 'react';
import { Link2, CheckCircle2, AlertCircle, Loader2, Search, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminStat from './ui/AdminStat';
import AdminBadge from './ui/AdminBadge';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';

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
  const [pendingDeactivate, setPendingDeactivate] = useState(null); // profile | null

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

  const applyTypeChange = async (profile, newType) => {
    setBusyId(profile.id);
    try {
      await api.adminUpdateProfileFields(profile.id, { card_type: newType });
      setRows((prev) => prev.map((p) => p.id === profile.id ? { ...p, card_type: newType } : p));
      setFeedbackMsg('success', `Perfil /${profile.slug} cambiado a tipo "${newType}".`);
    } catch (err) {
      setFeedbackMsg('error', err.message || 'No se pudo cambiar el tipo.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleType = (profile) => {
    const isReview = profile.card_type === 'review';
    if (isReview) {
      // Deactivating breaks the redirect for any physical NFC card already
      // pointing customers at this profile's review link — confirm first.
      setPendingDeactivate(profile);
      return;
    }
    applyTypeChange(profile, 'review');
  };

  const confirmDeactivate = async () => {
    if (!pendingDeactivate) return;
    const profile = pendingDeactivate;
    setPendingDeactivate(null);
    await applyTypeChange(profile, 'nfc');
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
      await api.adminUpdateProfileFields(profile.id, { review_url: draftUrl.trim(), card_type: 'review' });
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
    <AdminShell
      active="nexreview"
      title="NexReview"
      subtitle="Configura tarjetas NFC que redirigen directamente a tu página de reseñas de Google."
    >
      <div className="flex flex-col gap-6">

        {feedback.message && (
          <div
            role={feedback.type === 'success' ? 'status' : 'alert'}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400' : 'border-red-800 bg-red-950/40 text-red-400'}`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <AdminStat label="NexReview activos" value={reviewCards.length} accent="amber" />
          <AdminStat label="Perfiles NFC" value={nfcCards.length} />
        </div>

        {/* Cómo funciona */}
        <AdminCard className="border-emerald-900/40">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">¿Cómo funciona?</p>
          <ol className="space-y-2 text-sm font-medium text-zinc-300">
            <li><span className="font-black text-white">1.</span> Configura la URL de tu página de reseñas de Google Maps.</li>
            <li><span className="font-black text-white">2.</span> Activa el perfil como tipo <span className="text-amber-400 font-black">NexReview</span>.</li>
            <li><span className="font-black text-white">3.</span> Vincula una tarjeta NFC física a ese perfil en el panel Cards.</li>
            <li><span className="font-black text-white">4.</span> Al tocar la tarjeta, el cliente es redirigido directamente a dejar su reseña.</li>
          </ol>
        </AdminCard>

        {/* Buscador */}
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            aria-label="Buscar perfiles NexReview"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por slug, nombre o URL…"
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-sm font-medium text-white placeholder-zinc-500 shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </label>

        {/* Tabla de perfiles */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="font-bold text-lg text-white">Todos los perfiles</h2>
            <p className="text-zinc-500 text-sm font-medium">Activa NexReview y configura la URL de reseñas por perfil.</p>
          </div>
          <div className="overflow-x-auto" data-cy="nexreview-table">
          <Table>
            <THead>
              <TH>Perfil</TH>
              <TH>Tipo</TH>
              <TH>URL de reseñas</TH>
              <TH>Creado</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((profile) => {
                const isReview = profile.card_type === 'review';
                const isBusy = busyId === profile.id;
                const isEditing = editingId === profile.id;

                return (
                  <TR key={profile.id} className="align-top">
                    <TD>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                          style={{ backgroundColor: profile.theme_color || profile.color || '#10B981' }}
                        >
                          {(profile.full_name || profile.slug || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{profile.full_name || profile.slug}</p>
                          <p className="text-xs text-zinc-500">/{profile.slug}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <AdminBadge variant={isReview ? 'warning' : 'default'}>
                        {isReview ? 'NexReview' : 'NFC'}
                      </AdminBadge>
                    </TD>
                    <TD className="max-w-xs">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            aria-label="URL de reseñas de Google"
                            value={draftUrl}
                            onChange={(e) => setDraftUrl(e.target.value)}
                            placeholder="https://g.page/r/..."
                            className="min-h-[44px] flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-white placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveUrl(profile)}
                            disabled={isBusy}
                            className="min-h-[44px] shrink-0 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold disabled:opacity-50 transition-colors"
                          >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="min-h-[44px] shrink-0 px-3 py-2 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : profile.review_url ? (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-zinc-400 font-medium truncate max-w-[180px]">{profile.review_url}</p>
                          <a
                            href={profile.review_url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Abrir URL de reseñas de ${profile.full_name || profile.slug}`}
                            className="inline-flex min-w-[28px] min-h-[28px] items-center justify-center text-zinc-500 hover:text-emerald-400 shrink-0"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 font-medium">Sin URL configurada</p>
                      )}
                    </TD>
                    <TD className="text-sm text-zinc-400 font-medium">{formatDate(profile.created_at)}</TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => openEdit(profile)}
                          disabled={isBusy}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          <Link2 size={13} />
                          {profile.review_url ? 'Editar URL' : 'Añadir URL'}
                        </button>
                        <button
                          onClick={() => handleToggleType(profile)}
                          disabled={isBusy || (!profile.review_url && !isReview)}
                          title={!profile.review_url && !isReview ? 'Configura la URL primero' : undefined}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isReview ? 'border-amber-800 text-amber-300 hover:bg-amber-950/40' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
                        >
                          {isBusy
                            ? <Loader2 size={13} className="animate-spin" />
                            : isReview ? <ToggleRight size={13} /> : <ToggleLeft size={13} />
                          }
                          {isReview ? 'Desactivar' : 'Activar NexReview'}
                        </button>
                      </div>
                    </TD>
                  </TR>
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
          </Table>
          </div>
        </div>
      </div>

      {pendingDeactivate && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-nexreview-title"
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl"
          >
            <h3 id="deactivate-nexreview-title" className="text-lg font-bold text-white">Desactivar NexReview</h3>
            <p className="mt-2 text-sm font-medium text-zinc-400">
              ¿Confirmas desactivar NexReview para <span className="font-bold text-white">/{pendingDeactivate.slug}</span>?
              Si hay una tarjeta NFC física ya vinculada a este perfil, dejará de redirigir a la página de reseñas.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeactivate(null)}
                className="min-h-[44px] px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold transition-colors text-white bg-red-600 hover:bg-red-500"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default NexReviewDashboard;
