import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronUp, ChevronDown, Linkedin, Mail, Loader2, X } from 'lucide-react';
import AdminShell from './AdminShell';
import { api } from '../services/api';

const EMPTY_FORM = {
  name: '',
  role: '',
  bio: '',
  photo_url: '',
  linkedin_url: '',
  email: '',
  display_order: 0,
  active: true,
};

function MemberModal({ member, onSave, onClose }) {
  const [form, setForm] = useState(member || EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.role.trim()) { setError('Nombre y cargo son obligatorios'); return; }
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{member ? 'Editar miembro' : 'Agregar miembro'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {error && <p className="mb-4 text-red-400 text-sm bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Nombre *</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Cargo *</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.role} onChange={e => set('role', e.target.value)} placeholder="CTO" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Bio</label>
            <textarea className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none resize-none" rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Breve descripción..." />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">URL Foto</label>
            <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.photo_url} onChange={e => set('photo_url', e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">LinkedIn URL</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Email</label>
              <input type="email" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@nexcard.cl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Orden</label>
              <input type="number" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.display_order} onChange={e => set('display_order', Number(e.target.value))} min={0} />
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Activo</label>
              <button type="button" onClick={() => set('active', !form.active)} className={`w-12 h-6 rounded-full transition-colors relative ${form.active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.active ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-zinc-400 hover:text-white transition-colors border border-zinc-700">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamDashboard() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | member object
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { members: data } = await api.getAllTeamMembers();
      setMembers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (modal === 'create') {
      await api.createTeamMember(form);
    } else {
      await api.updateTeamMember(modal.id, form);
    }
    await load();
  };

  const handleToggle = async (member) => {
    setSaving(member.id);
    try {
      await api.updateTeamMember(member.id, { active: !member.active });
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, active: !m.active } : m));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id) => {
    setSaving(id);
    try {
      await api.deleteTeamMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } finally {
      setSaving(null);
      setDeleteId(null);
    }
  };

  const handleMove = async (index, direction) => {
    const newMembers = [...members];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= newMembers.length) return;
    [newMembers[index], newMembers[swapIndex]] = [newMembers[swapIndex], newMembers[index]];
    const updates = newMembers.map((m, i) => api.updateTeamMember(m.id, { display_order: i }));
    setMembers(newMembers.map((m, i) => ({ ...m, display_order: i })));
    await Promise.all(updates);
  };

  return (
    <AdminShell
      active="team"
      title="Equipo NexCard"
      subtitle="Sección administrable en la landing page"
      actions={
        <button onClick={() => setModal('create')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors">
          <Plus size={16} /> Agregar miembro
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-zinc-600" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-xl font-bold mb-2">Sin miembros</p>
          <p className="text-sm">Agrega el primer miembro del equipo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member, index) => {
            const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={member.id} className={`bg-zinc-900 border rounded-xl p-5 transition-colors ${member.active ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-zinc-700" onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-emerald-900 border border-emerald-800 flex items-center justify-center text-emerald-300 font-bold text-sm">
                        {initials}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm">{member.name}</p>
                      <p className="text-zinc-400 text-xs">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="p-1 text-zinc-600 hover:text-white transition-colors disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={() => handleMove(index, 1)} disabled={index === members.length - 1} className="p-1 text-zinc-600 hover:text-white transition-colors disabled:opacity-30"><ChevronDown size={14} /></button>
                  </div>
                </div>

                {member.bio && <p className="text-zinc-500 text-xs mb-4 leading-relaxed line-clamp-2">{member.bio}</p>}

                <div className="flex items-center gap-3 mb-4">
                  {member.linkedin_url && (
                    <a href={member.linkedin_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors"><Linkedin size={16} /></a>
                  )}
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="text-zinc-400 hover:text-white transition-colors"><Mail size={16} /></a>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(member)}
                      disabled={saving === member.id}
                      className={`w-10 h-5 rounded-full transition-colors relative ${member.active ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${member.active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <span className="text-xs text-zinc-500">{member.active ? 'Activo' : 'Inactivo'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal(member)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteId(member.id)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <MemberModal
          member={modal === 'create' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">¿Eliminar miembro?</h3>
            <p className="text-zinc-400 text-sm mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} disabled={saving === deleteId} className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving === deleteId ? <Loader2 size={16} className="animate-spin" /> : null}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
