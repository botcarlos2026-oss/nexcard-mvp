import React, { useEffect, useMemo, useState } from 'react';
import {
  History,
  Archive,
  User2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Search,
  Filter,
  Loader2,
  Clock3,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminBadge from './ui/AdminBadge';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CL');
};

const formatEventLabel = (value) => {
  if (!value) return 'Sin eventos';

  const labels = {
    profile_restore: 'Restore ejecutado',
    profile_snapshot: 'Snapshot generado',
    profile_soft_delete: 'Soft delete ejecutado',
  };

  return labels[value] || String(value).replace(/_/g, ' ');
};

const statusVariant = {
  active: 'success',
  pending: 'warning',
  archived: 'default',
};

const AdminProfilesDashboard = ({ profiles = [] }) => {
  const [rows, setRows] = useState(profiles);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyProfileId, setBusyProfileId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    setRows(profiles);
  }, [profiles]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rows.filter((profile) => {
      const haystack = [
        profile.slug,
        profile.full_name,
        profile.status,
        profile.last_event?.action,
        profile.latest_version ? `v${profile.latest_version}` : '',
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesTerm = !term || haystack.includes(term);
      const matchesStatus = statusFilter === 'all' || profile.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  const availableStatuses = useMemo(() => {
    const values = new Set(rows.map((profile) => profile.status).filter(Boolean));
    return ['all', ...Array.from(values)];
  }, [rows]);

  const runProfileAction = async (profile, action) => {
    setBusyProfileId(profile.id);
    setFeedback({ type: '', message: '' });

    try {
      const response = action === 'archive'
        ? await api.archiveProfile(profile.id)
        : await api.restoreProfileVersion(profile.id, profile.latest_version);

      setRows(response.profiles || []);
      setFeedback({
        type: 'success',
        message: action === 'archive'
          ? `Perfil ${profile.slug} archivado con soft delete.`
          : `Perfil ${profile.slug} restaurado desde versión v${profile.latest_version}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'No fue posible ejecutar la acción sobre el perfil.',
      });
    } finally {
      setBusyProfileId(null);
    }
  };

  return (
    <AdminShell active="profiles" title="Profiles Recovery Desk" subtitle="Historial utilizable, soft delete mínimo y restore visible para perfiles con versiones.">

      {feedback.message && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/50 text-emerald-400' : 'border-red-800 bg-red-950/50 text-red-400'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-3 py-2">Total: {rows.length}</span>
        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-3 py-2">Filtrados: {filtered.length}</span>
        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-3 py-2">Archivados: {rows.filter((profile) => profile.deleted_at).length}</span>
        {searchTerm.trim() && <span className="rounded-full bg-emerald-900 border border-emerald-700 px-3 py-2 text-emerald-400">Búsqueda activa</span>}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="flex gap-3 flex-1 flex-col sm:flex-row">
            <label className="relative flex-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Buscar por slug, nombre, status, evento o versión"
                className="w-full px-5 py-2.5 pl-10 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <select
                className="w-full appearance-none px-4 py-2.5 pl-10 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors sm:w-56"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'Todos los status' : status}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto" data-cy="admin-profiles-table">
          <Table>
            <THead>
              <TH>Profile</TH>
              <TH>Status</TH>
              <TH>Deleted</TH>
              <TH>Versions</TH>
              <TH>Snapshot / Restore</TH>
              <TH>Last Event</TH>
              <TH>Updated</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <tbody className="divide-y divide-zinc-800/60">
              {filtered.map((profile) => {
                const isBusy = busyProfileId === profile.id;
                const canArchive = !profile.deleted_at && profile.status !== 'archived';
                const canRestore = Boolean(profile.deleted_at && profile.can_restore && profile.latest_version);

                return (
                  <TR key={profile.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-800 rounded-xl text-zinc-400">
                          <User2 size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{profile.full_name || 'Sin nombre'}</p>
                          <p className="text-xs text-zinc-400 font-medium">/{profile.slug}</p>
                          <p className="text-[11px] text-zinc-500 font-medium mt-1">ID: {profile.id}</p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <AdminBadge variant={statusVariant[profile.status] || 'default'}>
                        {profile.status || '-'}
                      </AdminBadge>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-1 text-sm">
                        <span>{profile.deleted_at ? 'Sí' : 'No'}</span>
                        <span className="text-xs text-zinc-500">{formatDate(profile.deleted_at)}</span>
                      </div>
                    </TD>
                    <TD>
                      <div className="space-y-2">
                        <p className="font-bold text-sm text-white">{profile.version_count || 0} total</p>
                        <div className="flex flex-wrap gap-2">
                          {(profile.versions || []).length > 0 ? (
                            profile.versions.map((version) => (
                              <span key={`${profile.id}-${version.version}`} className="inline-flex rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-300">
                                v{version.version}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-zinc-500">Sin snapshots</span>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock3 size={14} className="text-zinc-500" />
                          <span>Último snapshot: {profile.latest_snapshot_at ? `v${profile.latest_version} · ${formatDate(profile.latest_snapshot_at)}` : '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-zinc-500" />
                          <span>Último restore: {profile.last_restore_version ? `v${profile.last_restore_version}` : 'No registrado'}</span>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="space-y-1">
                        <p className="font-semibold text-zinc-300">{formatEventLabel(profile.last_event?.action)}</p>
                        <p className="text-xs text-zinc-500">{formatDate(profile.last_event?.created_at)}</p>
                      </div>
                    </TD>
                    <TD>{formatDate(profile.updated_at)}</TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canRestore || isBusy}
                          onClick={() => runProfileAction(profile, 'restore')}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${canRestore && !isBusy ? 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-emerald-600 hover:text-emerald-400' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
                          title={canRestore ? `Restaurar usando v${profile.latest_version}` : 'Restore visible pero no habilitado'}
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                          Restore
                        </button>
                        <button
                          type="button"
                          disabled={!canArchive || isBusy}
                          onClick={() => runProfileAction(profile, 'archive')}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${canArchive && !isBusy ? 'px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'}`}
                          title={canArchive ? 'Archivar perfil' : 'Perfil ya archivado o no elegible'}
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                          Archive
                        </button>
                        <div className="flex items-center gap-2 text-zinc-500 pl-2">
                          {(profile.version_count || 0) > 0 && <History size={16} title="Tiene historial" />}
                          {profile.deleted_at && <Archive size={16} title="Archivado" />}
                        </div>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>
    </AdminShell>
  );
};

export default AdminProfilesDashboard;
