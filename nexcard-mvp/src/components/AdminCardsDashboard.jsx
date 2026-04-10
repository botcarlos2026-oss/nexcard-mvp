import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Archive, ShieldBan, Link as LinkIcon, Loader2, CheckCircle2, AlertCircle, Search, Clock3, Filter, UserPlus, X, Zap, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

const badgeClasses = {
  printed: 'bg-zinc-100 text-zinc-700',
  assigned: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  revoked: 'bg-rose-100 text-rose-700',
  archived: 'bg-zinc-200 text-zinc-700',
};

const activationBadgeClasses = {
  pending: 'bg-zinc-100 text-zinc-700',
  unassigned: 'bg-zinc-100 text-zinc-700',
  assigned: 'bg-sky-100 text-sky-700',
  activated: 'bg-emerald-100 text-emerald-700',
  active: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-rose-100 text-rose-700',
};

const formatLabel = (value) => (value ? String(value).replace(/_/g, ' ') : '-');

const formatTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const lastEventLabel = (eventType) => {
  if (!eventType) return 'Sin eventos';
  const labels = {
    activated: 'Activada',
    assigned: 'Asignada',
    archived: 'Archivada',
    created: 'Creada',
    printed: 'Impresa',
    revoked: 'Revocada',
    scan: 'Scan',
    suspended: 'Suspendida',
    unassigned: 'Sin asignar',
    updated: 'Actualizada',
  };
  return labels[eventType] || formatLabel(eventType);
};

const buildLifecycleFlags = (card) => {
  const flags = [];
  if (card.deleted_at) flags.push('Deleted');
  if (card.revoked_at) flags.push('Revoked');
  if (card.archived_at || card.status === 'archived') flags.push('Archived');
  if (card.updated_at) flags.push('Updated');
  return flags.length ? flags : ['Healthy'];
};

const isCardActive = (card) => card.activation_status === 'activated' || card.status === 'active';
const needsReassign = (card) => Boolean(card.profile_id) && !isCardActive(card) && card.status !== 'revoked' && card.status !== 'archived';

const AdminCardsDashboard = ({ cards = [], profiles = [] }) => {
  const [rows, setRows] = useState(cards);
  const [profileRows, setProfileRows] = useState(profiles);
  const [busyCardId, setBusyCardId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [assigningCard, setAssigningCard] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [expandedCardId, setExpandedCardId] = useState(null);

  useEffect(() => {
    setRows(cards);
  }, [cards]);

  useEffect(() => {
    setProfileRows(profiles);
  }, [profiles]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return rows.filter((card) => {
      const matchesStatus = statusFilter === 'all' ? true : card.status === statusFilter || card.activation_status === statusFilter;
      if (!matchesStatus) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        card.card_code,
        card.public_token,
        card.profile_slug,
        card.profile_name,
        card.profile_id,
        card.status,
        card.activation_status,
        card.last_event?.event_type,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [rows, searchTerm, statusFilter]);

  const availableStatuses = useMemo(() => {
    const values = new Set();
    rows.forEach((card) => {
      if (card.status) values.add(card.status);
      if (card.activation_status) values.add(card.activation_status);
    });
    return ['all', ...Array.from(values)];
  }, [rows]);

  const canRevoke = (card) => !card.deleted_at && card.status !== 'revoked' && card.status !== 'archived';
  const canArchive = (card) => !card.deleted_at && card.status !== 'archived';
  const canAssign = (card) => !card.deleted_at && card.status !== 'archived' && card.status !== 'revoked' && !card.profile_id && !isCardActive(card);
  const canReassign = (card) => !card.deleted_at && needsReassign(card);
  const canActivate = (card) => !card.deleted_at && card.status !== 'revoked' && card.status !== 'archived' && card.profile_id && !isCardActive(card);

  const runCardAction = async (card, action) => {
    setBusyCardId(card.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = action === 'revoke'
        ? await api.revokeCard(card.id)
        : action === 'activate'
          ? await api.activateCard(card.id)
          : await api.archiveCard(card.id);
      setRows(response.cards || []);
      setProfileRows(response.profiles || profileRows);
      setFeedback({
        type: 'success',
        message: action === 'revoke'
          ? `Tarjeta ${card.card_code} revocada.`
          : action === 'activate'
            ? `Tarjeta ${card.card_code} activada.`
            : `Tarjeta ${card.card_code} archivada.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible ejecutar la acción sobre la tarjeta.' });
    } finally {
      setBusyCardId(null);
    }
  };

  const openAssignModal = (card) => {
    setAssigningCard(card);
    setSelectedProfileId(card.profile_id || profileRows[0]?.id || '');
  };

  const closeAssignModal = () => {
    setAssigningCard(null);
    setSelectedProfileId('');
  };

  const handleAssign = async () => {
    if (!assigningCard) return;
    setBusyCardId(assigningCard.id);
    setFeedback({ type: '', message: '' });
    try {
      const response = needsReassign(assigningCard)
        ? await api.reassignCard(assigningCard.id, selectedProfileId)
        : await api.assignCard(assigningCard.id, selectedProfileId);
      setRows(response.cards || []);
      setProfileRows(response.profiles || profileRows);
      setFeedback({
        type: 'success',
        message: needsReassign(assigningCard)
          ? `Tarjeta ${assigningCard.card_code} reasignada correctamente.`
          : `Tarjeta ${assigningCard.card_code} asignada correctamente.`,
      });
      closeAssignModal();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible actualizar la asignación de la tarjeta.' });
    } finally {
      setBusyCardId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:justify-between lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Cards Control Center</h1>
            <p className="text-zinc-500 font-medium">Lifecycle mínimo NFC: visibilidad, filtros rápidos y acciones controladas sobre tarjetas.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por código, token, profile o evento" className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-zinc-700 shadow-sm outline-none transition focus:border-zinc-400 sm:w-80" />
            </label>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full appearance-none rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-zinc-700 shadow-sm outline-none transition focus:border-zinc-400 sm:w-52">
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>{status === 'all' ? 'Todos los status' : formatLabel(status)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {feedback.message && (
          <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
          <span className="rounded-full bg-white px-3 py-2 shadow-sm border border-zinc-200">Total: {rows.length}</span>
          <span className="rounded-full bg-white px-3 py-2 shadow-sm border border-zinc-200">Filtradas: {filteredRows.length}</span>
          {statusFilter !== 'all' && <span className="rounded-full bg-sky-50 px-3 py-2 shadow-sm border border-sky-200 text-sky-700">Status: {formatLabel(statusFilter)}</span>}
          {searchTerm.trim() && <span className="rounded-full bg-zinc-900 px-3 py-2 shadow-sm text-white">Búsqueda activa</span>}
        </div>

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden" data-cy="admin-cards-table">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-8 py-4">Card</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Activation</th>
                  <th className="px-8 py-4">Profile</th>
                  <th className="px-8 py-4">Deleted</th>
                  <th className="px-8 py-4">Flags</th>
                  <th className="px-8 py-4">Timeline</th>
                  <th className="px-8 py-4">Último evento</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredRows.map((card) => {
                  const isBusy = busyCardId === card.id;
                  const revokeDisabled = isBusy || !canRevoke(card);
                  const archiveDisabled = isBusy || !canArchive(card);
                  const assignDisabled = isBusy || (!canAssign(card) && !canReassign(card));
                  const activateDisabled = isBusy || !canActivate(card);
                  const flags = buildLifecycleFlags(card);

                  return (
                    <tr key={card.id} className="hover:bg-zinc-50/30 transition-colors align-top">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-100 rounded-xl text-zinc-400"><CreditCard size={18} /></div>
                          <div>
                            <p className="font-black text-sm">{card.card_code}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                              <span>{card.public_token || 'sin token'}</span>
                              {card.public_token && <LinkIcon size={14} title="Token activo" />}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5"><span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${badgeClasses[card.status] || 'bg-zinc-100 text-zinc-700'}`}>{formatLabel(card.status)}</span></td>
                      <td className="px-8 py-5"><span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${activationBadgeClasses[card.activation_status] || 'bg-zinc-100 text-zinc-700'}`}>{formatLabel(card.activation_status)}</span></td>
                      <td className="px-8 py-5 text-sm font-medium text-zinc-700">
                        <div>
                          <p className="font-black text-zinc-900">{card.profile_name || 'Sin perfil asignado'}</p>
                          <p className="text-xs text-zinc-500">{card.profile_slug || card.profile_id || '—'}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {card.profile_id && !isCardActive(card) && card.status !== 'revoked' && card.status !== 'archived' ? (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 border border-amber-200">Usar reassign</span>
                            ) : null}
                            {!card.profile_id && card.status !== 'revoked' && card.status !== 'archived' ? (
                              <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-sky-700 border border-sky-200">Lista para assign</span>
                            ) : null}
                          </div>
                          {card.profile_slug && <a href={`/${card.profile_slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-600">Ver perfil</a>}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-medium text-zinc-700">{card.deleted_at ? 'Sí' : 'No'}</td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-2">{flags.map((flag) => <span key={flag} className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-600">{flag}</span>)}</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-2 text-xs font-medium text-zinc-600 min-w-[220px]">
                          <div className="flex items-start gap-2">
                            <Clock3 size={14} className="mt-0.5 text-zinc-400" />
                            <div>
                              <p><span className="font-black text-zinc-700">Updated:</span> {formatTimestamp(card.updated_at)}</p>
                              <p><span className="font-black text-zinc-700">Revoked:</span> {formatTimestamp(card.revoked_at)}</p>
                              <p><span className="font-black text-zinc-700">Deleted:</span> {formatTimestamp(card.deleted_at)}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="min-w-[200px] text-sm">
                          <p className="font-black text-zinc-800">{lastEventLabel(card.last_event?.event_type)}</p>
                          <p className="text-xs font-medium text-zinc-400">{formatTimestamp(card.last_event?.created_at)}</p>
                          {card.events?.length > 0 && (
                            <button type="button" onClick={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)} className="mt-2 text-[11px] font-black uppercase tracking-wide text-sky-600">
                              {expandedCardId === card.id ? 'Ocultar historial' : 'Ver historial'}
                            </button>
                          )}
                          {expandedCardId === card.id && card.events?.length > 0 && (
                            <div className="mt-3 space-y-2 rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
                              {card.events.map((event, index) => (
                                <div key={`${card.id}-event-${index}`} className="text-xs">
                                  <p className="font-black text-zinc-800">{lastEventLabel(event.event_type)}</p>
                                  <p className="text-zinc-400">{formatTimestamp(event.created_at)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex justify-end items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => openAssignModal(card)} disabled={assignDisabled} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : canReassign(card) ? <RefreshCw size={14} /> : <UserPlus size={14} />}
                            {canReassign(card) ? 'Reassign' : 'Assign'}
                          </button>
                          <button type="button" onClick={() => runCardAction(card, 'activate')} disabled={activateDisabled} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Activate
                          </button>
                          <button type="button" onClick={() => runCardAction(card, 'revoke')} disabled={revokeDisabled} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldBan size={14} />}
                            Revoke
                          </button>
                          <button type="button" onClick={() => runCardAction(card, 'archive')} disabled={archiveDisabled} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr><td colSpan={9} className="px-8 py-12 text-center text-sm font-semibold text-zinc-500">No hay tarjetas que coincidan con los filtros activos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {assigningCard && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl border border-zinc-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-zinc-950">{needsReassign(assigningCard) ? 'Reasignar tarjeta' : 'Asignar tarjeta'}</h3>
                <p className="text-sm text-zinc-500 font-medium">{needsReassign(assigningCard) ? 'Cambia el perfil de una tarjeta ya asignada, sin permitir cards activas.' : 'Vincula la tarjeta a un perfil real para operar lifecycle con contexto.'}</p>
              </div>
              <button onClick={closeAssignModal} className="p-2 text-zinc-400 hover:text-zinc-950 transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Tarjeta</p>
                <p className="mt-1 font-black text-zinc-950">{assigningCard.card_code}</p>
                <p className="text-xs text-zinc-500">{assigningCard.public_token || 'sin token público'}</p>
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Perfil</span>
                <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500/20">
                  <option value="">Selecciona un perfil</option>
                  {profileRows.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.slug} ({profile.slug})</option>)}
                </select>
              </label>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={closeAssignModal} className="px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-700 font-bold text-sm">Cancelar</button>
                <button type="button" onClick={handleAssign} disabled={!selectedProfileId || busyCardId === assigningCard.id} className="px-5 py-3 rounded-2xl bg-sky-500 text-white font-bold text-sm shadow-lg shadow-sky-200 inline-flex items-center gap-2 disabled:opacity-60">
                  {busyCardId === assigningCard.id ? <Loader2 size={16} className="animate-spin" /> : needsReassign(assigningCard) ? <RefreshCw size={16} /> : <UserPlus size={16} />}
                  {needsReassign(assigningCard) ? 'Reasignar tarjeta' : 'Asignar tarjeta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCardsDashboard;
