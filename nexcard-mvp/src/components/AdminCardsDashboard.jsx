import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Archive, ShieldBan, Link as LinkIcon, Loader2, CheckCircle2, AlertCircle, Search, Clock3, Filter, UserPlus, X, Zap, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminStat from './ui/AdminStat';
import AdminBadge from './ui/AdminBadge';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';

const statusBadgeVariant = (status) => ({
  printed: 'default',
  assigned: 'info',
  active: 'success',
  suspended: 'warning',
  revoked: 'danger',
  archived: 'default',
}[status] || 'default');

const activationBadgeVariant = (status) => ({
  pending: 'default',
  unassigned: 'default',
  assigned: 'info',
  activated: 'success',
  active: 'success',
  revoked: 'danger',
}[status] || 'default');

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
  const [pendingAction, setPendingAction] = useState(null); // { card, action } | null
  const previouslyFocusedRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    setRows(cards);
  }, [cards]);

  useEffect(() => {
    setProfileRows(profiles);
  }, [profiles]);

  useEffect(() => {
    if (!assigningCard) return;
    previouslyFocusedRef.current = document.activeElement;
    firstFieldRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeAssignModal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [assigningCard]);

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

  const fleetStats = useMemo(() => {
    const unassigned = rows.filter((c) => !c.profile_id && c.status !== 'revoked' && c.status !== 'archived').length;
    const needsReassignCount = rows.filter(needsReassign).length;
    const activeCount = rows.filter(isCardActive).length;
    const inactiveCount = rows.filter((c) => c.status === 'revoked' || c.status === 'archived').length;
    return [
      { label: 'Sin asignar', value: unassigned, accent: unassigned > 0 ? 'blue' : null },
      { label: 'Necesita reasignar', value: needsReassignCount, accent: needsReassignCount > 0 ? 'amber' : null },
      { label: 'Activas', value: activeCount, accent: 'emerald' },
      { label: 'Revocadas / Archivadas', value: inactiveCount, accent: null },
    ];
  }, [rows]);

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

  const requestCardAction = (card, action) => {
    if (action === 'revoke' || action === 'archive') {
      setPendingAction({ card, action });
      return;
    }
    runCardAction(card, action);
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const { card, action } = pendingAction;
    setPendingAction(null);
    await runCardAction(card, action);
  };

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
    <AdminShell
      active="cards"
      title="Cards Control Center"
      subtitle="Lifecycle mínimo NFC: visibilidad, filtros rápidos y acciones controladas sobre tarjetas."
      actions={(
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input type="search" aria-label="Buscar tarjetas" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por código, token, profile o evento" className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-4 text-sm font-medium text-zinc-100 shadow-sm outline-none transition focus:border-emerald-500 sm:w-80" />
            </label>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <select aria-label="Filtrar por estado de tarjeta" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full appearance-none rounded-2xl border border-zinc-700 bg-zinc-900 py-3 pl-10 pr-10 text-sm font-medium text-zinc-100 shadow-sm outline-none transition focus:border-emerald-500 sm:w-52">
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>{status === 'all' ? 'Todos los status' : formatLabel(status)}</option>
                ))}
              </select>
            </label>
          </div>
      )}
    >
      <div className="max-w-7xl">
        {feedback.message && (
          <div
            role={feedback.type === 'success' ? 'status' : 'alert'}
            className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-red-800 bg-red-950/40 text-red-300'}`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {fleetStats.map((stat, i) => (
            <AdminStat key={i} label={stat.label} value={stat.value} accent={stat.accent} />
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
          <span className="rounded-full bg-zinc-900 px-3 py-2 shadow-sm border border-zinc-700 text-zinc-200">Total: {rows.length}</span>
          <span className="rounded-full bg-zinc-900 px-3 py-2 shadow-sm border border-zinc-700 text-zinc-200">Filtradas: {filteredRows.length}</span>
          {statusFilter !== 'all' && <span className="rounded-full bg-sky-950/50 px-3 py-2 shadow-sm border border-sky-800 text-sky-300">Status: {formatLabel(statusFilter)}</span>}
          {searchTerm.trim() && <span className="rounded-full bg-emerald-600 px-3 py-2 shadow-sm text-white">Búsqueda activa</span>}
        </div>

        <div data-cy="admin-cards-table">
          <Table>
            <THead>
              <TH>Tarjeta</TH>
              <TH>Estado</TH>
              <TH>Perfil</TH>
              <TH>Eliminada</TH>
              <TH>Alertas</TH>
              <TH>Historial</TH>
              <TH>Último evento</TH>
              <TH className="text-right">Acciones</TH>
            </THead>
              <tbody className="divide-y divide-zinc-800">
                {filteredRows.map((card) => {
                  const isBusy = busyCardId === card.id;
                  const revokeDisabled = isBusy || !canRevoke(card);
                  const archiveDisabled = isBusy || !canArchive(card);
                  const assignDisabled = isBusy || (!canAssign(card) && !canReassign(card));
                  const activateDisabled = isBusy || !canActivate(card);
                  const flags = buildLifecycleFlags(card);

                  return (
                    <TR key={card.id} className="align-top">
                      <TD>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-800 rounded-xl text-zinc-300"><CreditCard size={18} /></div>
                          <div>
                            <p className="font-black text-sm">{card.card_code}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
                              <span>{card.public_token || 'sin token'}</span>
                              {card.public_token && <LinkIcon size={14} aria-label="Token activo" role="img" />}
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-col items-start gap-1.5">
                          <AdminBadge variant={statusBadgeVariant(card.status)}>{formatLabel(card.status)}</AdminBadge>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                            <span>Activación:</span>
                            <AdminBadge variant={activationBadgeVariant(card.activation_status)}>{formatLabel(card.activation_status)}</AdminBadge>
                          </div>
                        </div>
                      </TD>
                      <TD className="text-sm font-medium text-zinc-300">
                        <div>
                          <p className="font-black text-zinc-100">{card.profile_name || 'Sin perfil asignado'}</p>
                          <p className="text-xs text-zinc-500">{card.profile_slug || card.profile_id || '—'}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {card.profile_id && !isCardActive(card) && card.status !== 'revoked' && card.status !== 'archived' ? (
                              <AdminBadge variant="warning">Usar reassign</AdminBadge>
                            ) : null}
                            {!card.profile_id && card.status !== 'revoked' && card.status !== 'archived' ? (
                              <AdminBadge variant="info">Lista para assign</AdminBadge>
                            ) : null}
                          </div>
                          {card.profile_slug && <a href={`/${card.profile_slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-400">Ver perfil</a>}
                        </div>
                      </TD>
                      <TD className="text-sm font-medium text-zinc-300">{card.deleted_at ? 'Sí' : 'No'}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">{flags.map((flag) => <AdminBadge key={flag} variant="default">{flag}</AdminBadge>)}</div>
                      </TD>
                      <TD>
                        <div className="space-y-2 text-xs font-medium text-zinc-400 min-w-[220px]">
                          <div className="flex items-start gap-2">
                            <Clock3 size={14} className="mt-0.5 text-zinc-400" />
                            <div>
                              <p><span className="font-black text-zinc-200">Updated:</span> {formatTimestamp(card.updated_at)}</p>
                              <p><span className="font-black text-zinc-200">Revoked:</span> {formatTimestamp(card.revoked_at)}</p>
                              <p><span className="font-black text-zinc-200">Deleted:</span> {formatTimestamp(card.deleted_at)}</p>
                            </div>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <div className="min-w-[200px] text-sm">
                          <p className="font-black text-zinc-100">{lastEventLabel(card.last_event?.event_type)}</p>
                          <p className="text-xs font-medium text-zinc-400">{formatTimestamp(card.last_event?.created_at)}</p>
                          {card.events?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
                              aria-expanded={expandedCardId === card.id}
                              aria-controls={`card-history-${card.id}`}
                              className="mt-2 min-h-[44px] text-[11px] font-black uppercase tracking-wide text-sky-400"
                            >
                              {expandedCardId === card.id ? 'Ocultar historial' : 'Ver historial'}
                            </button>
                          )}
                          {expandedCardId === card.id && card.events?.length > 0 && (
                            <div id={`card-history-${card.id}`} className="mt-3 space-y-2 rounded-2xl bg-zinc-950 border border-zinc-800 p-3">
                              {card.events.map((event, index) => (
                                <div key={`${card.id}-event-${index}`} className="text-xs">
                                  <p className="font-black text-zinc-100">{lastEventLabel(event.event_type)}</p>
                                  <p className="text-zinc-400">{formatTimestamp(event.created_at)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex justify-end items-center gap-2 flex-wrap">
                          <button type="button" onClick={() => openAssignModal(card)} disabled={assignDisabled} className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-sky-800 px-3 py-2 text-xs font-black uppercase tracking-wide text-sky-300 transition hover:bg-sky-950/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : canReassign(card) ? <RefreshCw size={14} /> : <UserPlus size={14} />}
                            {canReassign(card) ? 'Reasignar' : 'Asignar'}
                          </button>
                          <button type="button" onClick={() => runCardAction(card, 'activate')} disabled={activateDisabled} className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-emerald-800 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                            Activar
                          </button>
                          <button type="button" onClick={() => requestCardAction(card, 'revoke')} disabled={revokeDisabled} className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-red-800 px-3 py-2 text-xs font-black uppercase tracking-wide text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldBan size={14} />}
                            Revocar
                          </button>
                          <button type="button" onClick={() => requestCardAction(card, 'archive')} disabled={archiveDisabled} className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-700 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500 disabled:hover:bg-transparent">
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                            Archivar
                          </button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr><td colSpan={8} className="px-8 py-12 text-center text-sm font-semibold text-zinc-400">No hay tarjetas que coincidan con los filtros activos.</td></tr>
                )}
              </tbody>
          </Table>
        </div>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-card-action-title"
            className="w-full max-w-sm rounded-[32px] bg-zinc-900 p-6 shadow-2xl border border-zinc-800"
          >
            <h3 id="pending-card-action-title" className="text-lg font-bold text-white">
              {pendingAction.action === 'revoke' ? 'Revocar tarjeta' : 'Archivar tarjeta'}
            </h3>
            <p className="mt-2 text-sm font-medium text-zinc-400">
              {pendingAction.action === 'revoke'
                ? <>¿Confirmas revocar <span className="font-black text-white">{pendingAction.card.card_code}</span>? Esta acción bloquea la tarjeta y no se puede deshacer.</>
                : <>¿Confirmas archivar <span className="font-black text-white">{pendingAction.card.card_code}</span>? La tarjeta dejará de estar operativa.</>}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-3 rounded-2xl border border-zinc-700 text-zinc-200 font-bold text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPendingAction}
                className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
              >
                {pendingAction.action === 'revoke' ? 'Revocar' : 'Archivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningCard && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-card-modal-title"
            className="w-full max-w-lg rounded-[32px] bg-zinc-900 p-6 shadow-2xl border border-zinc-800"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 id="assign-card-modal-title" className="text-2xl font-bold text-white">{needsReassign(assigningCard) ? 'Reasignar tarjeta' : 'Asignar tarjeta'}</h3>
                <p className="text-sm text-zinc-400 font-medium">{needsReassign(assigningCard) ? 'Cambia el perfil de una tarjeta ya asignada, sin permitir cards activas.' : 'Vincula la tarjeta a un perfil real para operar lifecycle con contexto.'}</p>
              </div>
              <button
                onClick={closeAssignModal}
                aria-label="Cerrar"
                className="inline-flex min-w-[44px] min-h-[44px] items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Tarjeta</p>
                <p className="mt-1 font-black text-white">{assigningCard.card_code}</p>
                <p className="text-xs text-zinc-500">{assigningCard.public_token || 'sin token público'}</p>
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Perfil</span>
                <select
                  ref={firstFieldRef}
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Selecciona un perfil</option>
                  {profileRows.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name || profile.slug} ({profile.slug})</option>)}
                </select>
              </label>

              {selectedProfileId && (
                <p className="rounded-xl bg-emerald-950/20 border border-emerald-900/40 px-4 py-3 text-sm font-medium text-emerald-300">
                  Vincularás <span className="font-black text-white">{assigningCard.card_code}</span> a{' '}
                  <span className="font-black text-white">
                    {(() => {
                      const profile = profileRows.find((p) => p.id === selectedProfileId);
                      return profile ? (profile.full_name || profile.slug) : selectedProfileId;
                    })()}
                  </span>.
                </p>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={closeAssignModal} className="px-4 py-3 rounded-2xl border border-zinc-700 text-zinc-200 font-bold text-sm">Cancelar</button>
                <button type="button" onClick={handleAssign} disabled={!selectedProfileId || busyCardId === assigningCard.id} className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 inline-flex items-center gap-2 disabled:opacity-60">
                  {busyCardId === assigningCard.id ? <Loader2 size={16} className="animate-spin" /> : needsReassign(assigningCard) ? <RefreshCw size={16} /> : <UserPlus size={16} />}
                  {needsReassign(assigningCard) ? 'Reasignar tarjeta' : 'Asignar tarjeta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default AdminCardsDashboard;
