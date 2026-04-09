import React, { useMemo, useState } from 'react';
import { History, Archive, User2 } from 'lucide-react';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CL');
};

const AdminProfilesDashboard = ({ profiles = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return profiles.filter((profile) => {
      const haystack = [
        profile.slug,
        profile.full_name,
        profile.status,
        profile.last_event?.action,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesTerm = !term || haystack.includes(term);
      const matchesStatus = statusFilter === 'all' || profile.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [profiles, searchTerm, statusFilter]);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Profiles Recovery Desk</h1>
            <p className="text-zinc-500 font-medium">Visibilidad mínima de historial, archivado y última actividad de perfiles</p>
          </div>
          <div className="flex gap-3">
            <a href="/admin" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Dashboard</a>
            <a href="/admin/cards" className="px-4 py-3 bg-zinc-950 text-white rounded-2xl font-bold text-sm">Cards</a>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-zinc-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex gap-3 flex-1">
              <input
                type="text"
                placeholder="Buscar por slug, nombre, status o último evento..."
                className="flex-1 px-5 py-3 bg-zinc-50 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="px-4 py-3 bg-zinc-50 rounded-2xl text-sm font-bold outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto" data-cy="admin-profiles-table">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-8 py-4">Profile</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4">Deleted</th>
                  <th className="px-8 py-4">Versions</th>
                  <th className="px-8 py-4">Last Event</th>
                  <th className="px-8 py-4">Updated</th>
                  <th className="px-8 py-4 text-right">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((profile) => (
                  <tr key={profile.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 rounded-xl text-zinc-400">
                          <User2 size={18} />
                        </div>
                        <div>
                          <p className="font-black text-sm">{profile.full_name}</p>
                          <p className="text-xs text-zinc-400 font-medium">/{profile.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold uppercase text-xs">{profile.status || '-'}</td>
                    <td className="px-8 py-5 text-sm font-medium">{profile.deleted_at ? 'Sí' : 'No'}</td>
                    <td className="px-8 py-5 text-sm font-black">{profile.version_count || 0}</td>
                    <td className="px-8 py-5 text-sm font-medium text-zinc-600">{profile.last_event?.action || '—'}</td>
                    <td className="px-8 py-5 text-sm font-medium text-zinc-600">{formatDate(profile.updated_at)}</td>
                    <td className="px-8 py-5">
                      <div className="flex justify-end gap-2 text-zinc-500">
                        {(profile.version_count || 0) > 0 && <History size={16} title="Tiene historial" />}
                        {profile.deleted_at && <Archive size={16} title="Archivado" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfilesDashboard;
