import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminStat from './ui/AdminStat';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const STAGES = [
  { key: 'nuevo_lead',      label: 'Nuevo Lead',   color: 'bg-zinc-100 text-zinc-600',     dot: 'bg-zinc-400' },
  { key: 'contactado',      label: 'Contactado',   color: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-400' },
  { key: 'propuesta',       label: 'Propuesta',    color: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-400' },
  { key: 'negociacion',     label: 'Negociación',  color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-400' },
  { key: 'cerrado_ganado',  label: 'Ganado',       color: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-400' },
  { key: 'cerrado_perdido', label: 'Perdido',      color: 'bg-rose-100 text-rose-700',      dot: 'bg-rose-400' },
];

const stageMap = Object.fromEntries(STAGES.map(s => [s.key, s]));

const daysSince = (iso) => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

const ActivityIcon = { call: '📞', email: '📧', meeting: '🤝', note: '📝', whatsapp: '💬' };

export default function CRMDashboard() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activities, setActivities] = useState([]);
  const [actForm, setActForm] = useState({ type: 'note', title: '', description: '' });
  const [actLoading, setActLoading] = useState(false);
  const [newDeal, setNewDeal] = useState(null);
  const [dragId, setDragId] = useState(null);

  const loadDeals = useCallback(async () => {
    try {
      const result = await api.getCRMDeals();
      setDeals(result.deals || []);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  useEffect(() => {
    if (!selected) return;
    api.getCRMActivities(selected.id).then(r => setActivities(r.activities || [])).catch(() => {});
  }, [selected?.id]);

  const handleDrop = async (stageKey, e) => {
    e.preventDefault();
    if (!dragId || dragId === stageKey) return;
    const deal = deals.find(d => d.id === dragId);
    if (!deal || deal.stage === stageKey) return;
    setDeals(prev => prev.map(d => d.id === dragId ? { ...d, stage: stageKey } : d));
    try { await api.updateCRMDeal(dragId, { stage: stageKey }); } catch { loadDeals(); }
    setDragId(null);
  };

  const metrics = {
    pipeline: deals.filter(d => !['cerrado_ganado','cerrado_perdido'].includes(d.stage)).reduce((s, d) => s + (d.amount_cents || 0), 0),
    active: deals.filter(d => !['cerrado_ganado','cerrado_perdido'].includes(d.stage)).length,
    wonMonth: deals.filter(d => {
      if (d.stage !== 'cerrado_ganado') return false;
      const m = new Date(); return new Date(d.updated_at).getMonth() === m.getMonth();
    }).length,
  };

  const newDealButton = (
    <button
      onClick={() => setNewDeal({ name: '', amount_cents: '', stage: 'nuevo_lead', contact_name: '', contact_email: '', contact_phone: '', contact_company: '', notes: '' })}
      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      + Nuevo deal
    </button>
  );

  return (
    <AdminShell active="crm" title="CRM · Pipeline" actions={newDealButton}>
      <div className="flex flex-col gap-6">

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          <AdminStat label="Pipeline total" value={CLP(metrics.pipeline)} accent="emerald" />
          <AdminStat label="Deals activos" value={metrics.active} />
          <AdminStat label="Ganados este mes" value={metrics.wonMonth} accent="emerald" />
        </div>

        {loading ? (
          <div className="text-zinc-400 text-sm">Cargando...</div>
        ) : (
          /* Kanban */
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {STAGES.map(stage => {
                const col = deals.filter(d => d.stage === stage.key);
                return (
                  <div
                    key={stage.key}
                    className="w-64 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(stage.key, e)}
                  >
                    <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                        <span className="font-bold text-sm text-white">{stage.label}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.color}`}>{col.length}</span>
                    </div>
                    <div className="p-3 flex flex-col gap-2.5 min-h-[120px]">
                      {col.length === 0 && <p className="text-zinc-600 text-xs text-center py-6">Sin deals</p>}
                      {col.map(deal => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          stage={stage}
                          onDragStart={() => setDragId(deal.id)}
                          onClick={() => { setSelected(deal); setActivities([]); }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Panel lateral */}
      {selected && (
        <DealPanel
          deal={selected}
          activities={activities}
          actForm={actForm}
          actLoading={actLoading}
          onActFormChange={setActForm}
          onAddActivity={async () => {
            if (!actForm.title.trim()) return;
            setActLoading(true);
            try {
              await api.addCRMActivity({ deal_id: selected.id, ...actForm });
              const r = await api.getCRMActivities(selected.id);
              setActivities(r.activities || []);
              setActForm({ type: 'note', title: '', description: '' });
            } catch { /* silencioso */ }
            finally { setActLoading(false); }
          }}
          onStageChange={async (stage) => {
            setDeals(prev => prev.map(d => d.id === selected.id ? { ...d, stage } : d));
            setSelected(prev => ({ ...prev, stage }));
            try { await api.updateCRMDeal(selected.id, { stage }); } catch { loadDeals(); }
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Modal nuevo deal */}
      {newDeal && (
        <NewDealModal
          form={newDeal}
          onChange={setNewDeal}
          onClose={() => setNewDeal(null)}
          onSave={async () => {
            try {
              let contactId = null;
              if (newDeal.contact_name.trim()) {
                const { data: c } = await (await import('../services/supabaseClient')).supabase
                  .from('crm_contacts').insert({ name: newDeal.contact_name, email: newDeal.contact_email || null, phone: newDeal.contact_phone || null, company: newDeal.contact_company || null }).select().single();
                contactId = c?.id || null;
              }
              await api.createCRMDeal({ name: newDeal.name, amount_cents: parseInt(newDeal.amount_cents) || 0, stage: newDeal.stage, notes: newDeal.notes || null, contact_id: contactId });
              await loadDeals();
              setNewDeal(null);
            } catch { /* silencioso */ }
          }}
        />
      )}
    </AdminShell>
  );
}

function DealCard({ deal, stage, onDragStart, onClick }) {
  const contact = deal.crm_contacts;
  const days = daysSince(deal.updated_at);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-zinc-800 border border-zinc-700 rounded-xl p-3.5 cursor-pointer hover:border-zinc-600 hover:bg-zinc-750 transition-all select-none"
    >
      <p className="font-bold text-sm text-white truncate">{deal.name}</p>
      {contact?.company && <p className="text-xs text-zinc-400 truncate mt-0.5">{contact.company}</p>}
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-sm font-bold text-zinc-200">{CLP(deal.amount_cents)}</span>
        <span className="text-[10px] text-zinc-500 font-medium">{days}d</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.color}`}>{stage.label}</span>
        {contact?.phone && (
          <a
            href={`https://wa.me/56${contact.phone.replace(/\D/g, '')}`}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-emerald-500 hover:text-emerald-400 text-xs"
          >💬</a>
        )}
      </div>
    </div>
  );
}

function DealPanel({ deal, activities, actForm, actLoading, onActFormChange, onAddActivity, onStageChange, onClose }) {
  const contact = deal.crm_contacts;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 className="font-bold text-lg text-white truncate pr-4">{deal.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6 flex flex-col gap-5">

          {/* Etapa */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Etapa</label>
            <select
              value={deal.stage}
              onChange={e => onStageChange(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            >
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          {/* Info deal */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
              <p className="text-zinc-500 text-xs font-bold">Monto</p>
              <p className="font-bold text-white">{CLP(deal.amount_cents)}</p>
            </div>
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3">
              <p className="text-zinc-500 text-xs font-bold">Días en etapa</p>
              <p className="font-bold text-white">{daysSince(deal.updated_at)}d</p>
            </div>
          </div>

          {/* Contacto */}
          {contact && (
            <div className="border border-zinc-800 rounded-xl p-4">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Contacto</p>
              <p className="font-bold text-white">{contact.name}</p>
              {contact.company && <p className="text-xs text-zinc-400">{contact.company}</p>}
              {contact.email && <p className="text-xs text-zinc-500 mt-1">{contact.email}</p>}
              {contact.phone && (
                <a href={`https://wa.me/56${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 font-bold mt-1 inline-block">💬 {contact.phone}</a>
              )}
            </div>
          )}

          {/* Notas */}
          {deal.notes && (
            <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-3 text-sm text-zinc-300">{deal.notes}</div>
          )}

          {/* Actividades */}
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Actividades</p>
            <div className="space-y-2.5 mb-4 max-h-56 overflow-y-auto">
              {activities.length === 0 && <p className="text-xs text-zinc-600">Sin actividades</p>}
              {activities.map(act => (
                <div key={act.id} className="flex gap-2.5 text-sm">
                  <span className="text-base leading-none mt-0.5">{ActivityIcon[act.type] || '📝'}</span>
                  <div>
                    <p className="font-bold text-white text-xs">{act.title}</p>
                    {act.description && <p className="text-zinc-500 text-xs mt-0.5">{act.description}</p>}
                    <p className="text-zinc-600 text-[10px] mt-0.5">{new Date(act.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Form actividad rápida */}
            <div className="border border-zinc-800 rounded-xl p-3 space-y-2.5">
              <div className="flex gap-2">
                <select
                  value={actForm.type}
                  onChange={e => onActFormChange(p => ({ ...p, type: e.target.value }))}
                  className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(ActivityIcon).map(([k,v]) => <option key={k} value={k}>{v} {k}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Título *"
                  value={actForm.title}
                  onChange={e => onActFormChange(p => ({ ...p, title: e.target.value }))}
                  className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Descripción (opcional)"
                value={actForm.description}
                onChange={e => onActFormChange(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={onAddActivity}
                disabled={actLoading || !actForm.title.trim()}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition-colors"
              >
                {actLoading ? 'Guardando...' : 'Agregar actividad'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewDealModal({ form, onChange, onClose, onSave }) {
  const inputClass = 'w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg text-white">Nuevo deal</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">×</button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="Nombre del deal *" value={form.name} onChange={e => onChange(p => ({ ...p, name: e.target.value }))} className={inputClass} />
          <input type="number" placeholder="Monto (CLP)" value={form.amount_cents} onChange={e => onChange(p => ({ ...p, amount_cents: e.target.value }))} className={inputClass} />
          <select value={form.stage} onChange={e => onChange(p => ({ ...p, stage: e.target.value }))} className={inputClass}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <p className="block text-xs uppercase tracking-wide text-zinc-500 font-medium pt-1">Contacto (opcional)</p>
          <input type="text" placeholder="Nombre del contacto" value={form.contact_name} onChange={e => onChange(p => ({ ...p, contact_name: e.target.value }))} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input type="email" placeholder="Email" value={form.contact_email} onChange={e => onChange(p => ({ ...p, contact_email: e.target.value }))} className={inputClass} />
            <input type="tel" placeholder="Teléfono" value={form.contact_phone} onChange={e => onChange(p => ({ ...p, contact_phone: e.target.value }))} className={inputClass} />
          </div>
          <input type="text" placeholder="Empresa" value={form.contact_company} onChange={e => onChange(p => ({ ...p, contact_company: e.target.value }))} className={inputClass} />
          <textarea placeholder="Notas (opcional)" value={form.notes} onChange={e => onChange(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          <button onClick={onSave} disabled={!form.name.trim()} className="flex-[2] py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Crear deal</button>
        </div>
      </div>
    </div>
  );
}
