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

const statusTone = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  archived: 'bg-zinc-200 text-zinc-700',
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
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Profiles Recovery Desk</h1>
            <p className="text-zinc-500 font-medium">Historial utilizable, soft delete mínimo y restore visible para perfiles con versiones.</p>
          </div>
          <div className="flex gap-3">
            <a href="/admin" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Dashboard</a>
            <a href="/admin/cards" className="px-4 py-3 bg-zinc-950 text-white rounded-2xl font-bold text-sm">Cards</a>
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
          <span className="rounded-full bg-white px-3 py-2 shadow-sm border border-zinc-200">Filtrados: {filtered.length}</span>
          <span className="rounded-full bg-white px-3 py-2 shadow-sm border border-zinc-200">Archivados: {rows.filter((profile) => profile.deleted_at).length}</span>
          {searchTerm.trim() && <span className="rounded-full bg-zinc-900 px-3 py-2 shadow-sm text-white">Búsqueda activa</span>}
        </div>

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex gap-3 flex-1 flex-col sm:flex-row">
              <label className="relative flex-1 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por slug, nombre, status, evento o versión"
                  className="w-full px-5 py-3 pl-10 bg-zinc-50 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>
              <label className="relative block">
                <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <select
                  className="w-full appearance-none px-4 py-3 pl-10 bg-zinc-50 rounded-2xl text-sm font-bold outline-none sm:w-56"
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
            <table className="w-full min-w-[1360px] text-left">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-8 py-4">Profile</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Deleted</th>
                  <th className="px-8 py-4">Versions</th>
                  <th className="px-8 py-4">Snapshot / Restore</th>
                  <th className="px-8 py-4">Last Event</th>
                  <th className="px-8 py-4">Updated</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((profile) => {
                  const isBusy = busyProfileId === profile.id;
                  const canArchive = !profile.deleted_at && profile.status !== 'archived';
                  const canRestore = Boolean(profile.deleted_at && profile.can_restore && profile.latest_version);

                  return (
                    <tr key={profile.id} className="hover:bg-zinc-50/30 transition-colors align-top">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-100 rounded-xl text-zinc-400">
                            <User2 size={18} />
                          </div>
                          <div>
                            <p className="font-black text-sm">{profile.full_name || 'Sin nombre'}</p>
                            <p className="text-xs text-zinc-400 font-medium">/{profile.slug}</p>
                            <p className="text-[11px] text-zinc-500 font-medium mt-1">ID: {profile.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${statusTone[profile.status] || 'bg-zinc-100 text-zinc-700'}`}>
                          {profile.status || '-'}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-sm font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{profile.deleted_at ? 'Sí' : 'No'}</span>
                          <span className="text-xs text-zinc-400">{formatDate(profile.deleted_at)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm">
                        <div className="space-y-2">
                          <p className="font-black">{profile.version_count || 0} total</p>
                          <div className="flex flex-wrap gap-2">
                            {(profile.versions || []).length > 0 ? (
                              profile.versions.map((version) => (
                                <span key={`${profile.id}-${version.version}`} className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-black text-zinc-700">
                                  v{version.version}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-zinc-400">Sin snapshots</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm text-zinc-600">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 font-semibold">
                            <Clock3 size={14} className="text-zinc-400" />
                            <span>Último snapshot: {profile.latest_snapshot_at ? `v${profile.latest_version} · ${formatDate(profile.latest_snapshot_at)}` : '—'}</span>
                          </div>
                          <div className="flex items-center gap-2 font-semibold">
                            <ShieldCheck size={14} className="text-zinc-400" />
                            <span>Último restore: {profile.last_restore_version ? `v${profile.last_restore_version}` : 'No registrado'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-medium text-zinc-600">
                        <div className="space-y-1">
                          <p className="font-semibold text-zinc-700">{formatEventLabel(profile.last_event?.action)}</p>
                          <p className="text-xs text-zinc-400">{formatDate(profile.last_event?.created_at)}</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-medium text-zinc-600">{formatDate(profile.updated_at)}</td>
                      <td className="px-8 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={!canRestore || isBusy}
                            onClick={() => runProfileAction(profile, 'restore')}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${canRestore && !isBusy ? 'bg-white border border-zinc-200 text-zinc-700 hover:border-emerald-300 hover:text-emerald-700' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}
                            title={canRestore ? `Restaurar usando v${profile.latest_version}` : 'Restore visible pero no habilitado'}
                          >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                            Restore
                          </button>
                          <button
                            type="button"
                            disabled={!canArchive || isBusy}
                            onClick={() => runProfileAction(profile, 'archive')}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${canArchive && !isBusy ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'}`}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfilesDashboard;
