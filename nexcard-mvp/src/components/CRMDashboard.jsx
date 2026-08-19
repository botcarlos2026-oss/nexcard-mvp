import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, Mail, Users, StickyNote, MessageCircle, CheckCircle2, AlertCircle, X, Pencil } from 'lucide-react';
import { api } from '../services/api';
import AdminShell from './AdminShell';
import AdminStat from './ui/AdminStat';
import AdminBadge from './ui/AdminBadge';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const STALE_DAYS = 7;

const CLOSED_STAGES = ['cerrado_ganado', 'cerrado_perdido'];

const STAGES = [
  { key: 'nuevo_lead',      label: 'Nuevo Lead',   variant: 'default', dot: 'bg-zinc-400' },
  { key: 'contactado',      label: 'Contactado',   variant: 'info',    dot: 'bg-blue-400' },
  { key: 'propuesta',       label: 'Propuesta',    variant: 'purple',  dot: 'bg-violet-400' },
  { key: 'negociacion',     label: 'Negociación',  variant: 'warning', dot: 'bg-amber-400' },
  { key: 'cerrado_ganado',  label: 'Ganado',       variant: 'success', dot: 'bg-emerald-400' },
  { key: 'cerrado_perdido', label: 'Perdido',      variant: 'danger',  dot: 'bg-red-400' },
];

const daysSince = (iso) => {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

const ActivityIcon = { call: Phone, email: Mail, meeting: Users, note: StickyNote, whatsapp: MessageCircle };
const activityTypeLabel = { call: 'Llamada', email: 'Email', meeting: 'Reunión', note: 'Nota', whatsapp: 'WhatsApp' };

export default function CRMDashboard() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activities, setActivities] = useState([]);
  const [actForm, setActForm] = useState({ type: 'note', title: '', description: '' });
  const [actLoading, setActLoading] = useState(false);
  const [newDeal, setNewDeal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [staleOnly, setStaleOnly] = useState(false);
  const [pendingClose, setPendingClose] = useState(null); // { dealId, dealName, stageKey, source: 'drag'|'panel' } | null
  const [lossReason, setLossReason] = useState('');

  const loadDeals = useCallback(async () => {
    try {
      const result = await api.getCRMDeals();
      setDeals(result.deals || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible cargar el pipeline de deals.' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  useEffect(() => {
    if (!selected) return;
    api.getCRMActivities(selected.id)
      .then(r => setActivities(r.activities || []))
      .catch((error) => setFeedback({ type: 'error', message: error.message || 'No fue posible cargar las actividades del deal.' }));
  }, [selected]);

  const applyStageChange = useCallback(async (dealId, stageKey, extraPatch = {}) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: stageKey, ...extraPatch } : d));
    setSelected(prev => (prev && prev.id === dealId) ? { ...prev, stage: stageKey, ...extraPatch } : prev);
    try {
      await api.updateCRMDeal(dealId, { stage: stageKey, ...extraPatch });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible actualizar la etapa del deal.' });
      loadDeals();
    }
  }, [loadDeals]);

  const handleDrop = (stageKey, e) => {
    e.preventDefault();
    if (!dragId || dragId === stageKey) { setDragId(null); return; }
    const deal = deals.find(d => d.id === dragId);
    if (!deal || deal.stage === stageKey) { setDragId(null); return; }
    if (CLOSED_STAGES.includes(stageKey)) {
      setPendingClose({ dealId: dragId, dealName: deal.name, stageKey });
    } else {
      applyStageChange(dragId, stageKey);
    }
    setDragId(null);
  };

  const requestStageChange = (dealId, dealName, stageKey) => {
    if (CLOSED_STAGES.includes(stageKey)) {
      setPendingClose({ dealId, dealName, stageKey });
    } else {
      applyStageChange(dealId, stageKey);
    }
  };

  const confirmPendingClose = async () => {
    if (!pendingClose) return;
    const { dealId, stageKey } = pendingClose;
    const extraPatch = {};
    if (stageKey === 'cerrado_perdido' && lossReason.trim()) {
      const currentDeal = deals.find(d => d.id === dealId);
      const prefix = currentDeal?.notes ? `${currentDeal.notes}\n\n` : '';
      extraPatch.notes = `${prefix}Motivo de pérdida: ${lossReason.trim()}`;
    }
    setPendingClose(null);
    setLossReason('');
    await applyStageChange(dealId, stageKey, extraPatch);
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
      className="min-h-[44px] px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      + Nuevo deal
    </button>
  );

  const staleCount = deals.filter(d => !CLOSED_STAGES.includes(d.stage) && daysSince(d.updated_at) >= STALE_DAYS).length;

  return (
    <AdminShell active="crm" title="CRM · Pipeline" actions={newDealButton}>
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
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          <AdminStat label="Pipeline total" value={CLP(metrics.pipeline)} accent="emerald" />
          <AdminStat label="Deals activos" value={metrics.active} />
          <AdminStat label="Ganados este mes" value={metrics.wonMonth} accent="emerald" />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setStaleOnly(v => !v)}
            aria-pressed={staleOnly}
            className={`min-h-[44px] inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${staleOnly ? 'border-amber-700 bg-amber-950/30 text-amber-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
          >
            Requieren seguimiento ({staleCount})
          </button>
        </div>

        {loading ? (
          <div className="text-zinc-400 text-sm">Cargando...</div>
        ) : (
          /* Kanban */
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {STAGES.map(stage => {
                const col = deals.filter(d => d.stage === stage.key && (!staleOnly || (!CLOSED_STAGES.includes(d.stage) && daysSince(d.updated_at) >= STALE_DAYS)));
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
                      <AdminBadge variant={stage.variant}>{col.length}</AdminBadge>
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
              setFeedback({ type: 'success', message: 'Actividad agregada.' });
            } catch (error) {
              setFeedback({ type: 'error', message: error.message || 'No fue posible agregar la actividad.' });
            } finally { setActLoading(false); }
          }}
          onStageChange={(stage) => requestStageChange(selected.id, selected.name, stage)}
          onSaveEdits={async (draft) => {
            try {
              if (Number.isFinite(draft.amount_cents)) {
                await api.updateCRMDeal(selected.id, { amount_cents: draft.amount_cents });
              }
              const contact = selected.crm_contacts;
              if (draft.contact_name.trim()) {
                if (contact?.id) {
                  await api.updateCRMContact(contact.id, {
                    name: draft.contact_name,
                    email: draft.contact_email || null,
                    phone: draft.contact_phone || null,
                    company: draft.contact_company || null,
                  });
                } else {
                  const newContact = await api.createCRMContact({
                    name: draft.contact_name,
                    email: draft.contact_email || null,
                    phone: draft.contact_phone || null,
                    company: draft.contact_company || null,
                  });
                  await api.updateCRMDeal(selected.id, { contact_id: newContact.id });
                }
              }
              const result = await api.getCRMDeals();
              setDeals(result.deals || []);
              setSelected(prev => (result.deals || []).find(d => d.id === prev.id) || prev);
              setFeedback({ type: 'success', message: 'Deal actualizado.' });
            } catch (error) {
              setFeedback({ type: 'error', message: error.message || 'No fue posible guardar los cambios.' });
            }
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Modal confirmar cierre de deal */}
      {pendingClose && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pending-close-title"
            className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl"
          >
            <h3 id="pending-close-title" className="text-lg font-bold text-white">
              {pendingClose.stageKey === 'cerrado_ganado' ? 'Marcar deal como ganado' : 'Marcar deal como perdido'}
            </h3>
            <p className="mt-2 text-sm font-medium text-zinc-400">
              ¿Confirmas mover <span className="font-bold text-white">{pendingClose.dealName}</span> a{' '}
              <span className="font-bold text-white">{pendingClose.stageKey === 'cerrado_ganado' ? 'Ganado' : 'Perdido'}</span>?
            </p>
            {pendingClose.stageKey === 'cerrado_perdido' && (
              <label className="block mt-3">
                <span className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Motivo (opcional)</span>
                <input
                  type="text"
                  autoFocus
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  placeholder="Ej: precio, eligió otra solución, sin respuesta..."
                  className="mt-1.5 min-h-[44px] w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </label>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setPendingClose(null); setLossReason(''); }}
                className="min-h-[44px] px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPendingClose}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold transition-colors text-white ${pendingClose.stageKey === 'cerrado_ganado' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-600 hover:bg-red-500'}`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
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
                const contact = await api.createCRMContact({
                  name: newDeal.contact_name,
                  email: newDeal.contact_email || null,
                  phone: newDeal.contact_phone || null,
                  company: newDeal.contact_company || null,
                });
                contactId = contact?.id || null;
              }
              await api.createCRMDeal({ name: newDeal.name, amount_cents: parseInt(newDeal.amount_cents) || 0, stage: newDeal.stage, notes: newDeal.notes || null, contact_id: contactId });
              await loadDeals();
              setNewDeal(null);
              setFeedback({ type: 'success', message: `Deal "${newDeal.name}" creado.` });
            } catch (error) {
              setFeedback({ type: 'error', message: error.message || 'No fue posible crear el deal.' });
            }
          }}
        />
      )}
    </AdminShell>
  );
}

function DealCard({ deal, stage, onDragStart, onClick }) {
  const contact = deal.crm_contacts;
  const days = daysSince(deal.updated_at);
  const isStale = !CLOSED_STAGES.includes(deal.stage) && days >= STALE_DAYS;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={`Ver detalle de ${deal.name}`}
      className="bg-zinc-800 border border-zinc-700 rounded-xl p-3.5 cursor-pointer hover:border-zinc-600 hover:bg-zinc-700 transition-all select-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
      <p className="font-bold text-sm text-white truncate">{deal.name}</p>
      {contact?.company && <p className="text-xs text-zinc-400 truncate mt-0.5">{contact.company}</p>}
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-sm font-bold text-zinc-200">{CLP(deal.amount_cents)}</span>
        <span className={`text-[10px] font-bold ${isStale ? 'text-amber-400' : 'text-zinc-500'}`}>{days}d{isStale ? ' · seguimiento' : ''}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <AdminBadge variant={stage.variant}>{stage.label}</AdminBadge>
        {contact?.phone && (
          <a
            href={`https://wa.me/56${contact.phone.replace(/\D/g, '')}`}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            aria-label={`Escribir por WhatsApp a ${contact.name || contact.phone}`}
            className="inline-flex min-w-[44px] min-h-[44px] -my-2.5 items-center justify-center text-emerald-500 hover:text-emerald-400"
          >
            <MessageCircle size={16} />
          </a>
        )}
      </div>
    </div>
  );
}

function DealPanel({ deal, activities, actForm, actLoading, onActFormChange, onAddActivity, onStageChange, onSaveEdits, onClose }) {
  const contact = deal.crm_contacts;
  const previouslyFocusedRef = useRef(null);
  const panelRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editDraft, setEditDraft] = useState(null);

  const startEdit = () => {
    setEditDraft({
      amount_cents: String(deal.amount_cents || 0),
      contact_name: contact?.name || '',
      contact_email: contact?.email || '',
      contact_phone: contact?.phone || '',
      contact_company: contact?.company || '',
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await onSaveEdits({ ...editDraft, amount_cents: parseInt(editDraft.amount_cents, 10) || 0 });
      setEditMode(false);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-panel-title"
        className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl overflow-y-auto flex flex-col outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <h2 id="deal-panel-title" className="font-bold text-lg text-white truncate pr-4">{deal.name}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex min-w-[44px] min-h-[44px] items-center justify-center text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
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

          {editMode ? (
            <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Editar deal</p>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-zinc-500 font-medium">Monto (CLP)</span>
                <input
                  type="number"
                  aria-label="Monto en CLP"
                  value={editDraft.amount_cents}
                  onChange={(e) => setEditDraft(p => ({ ...p, amount_cents: e.target.value }))}
                  className="mt-1 min-h-[44px] w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </label>
              <p className="text-xs uppercase tracking-wide text-zinc-500 font-medium pt-1">Contacto</p>
              <input
                type="text"
                placeholder="Nombre del contacto"
                aria-label="Nombre del contacto"
                value={editDraft.contact_name}
                onChange={(e) => setEditDraft(p => ({ ...p, contact_name: e.target.value }))}
                className="min-h-[44px] w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="email"
                  placeholder="Email"
                  aria-label="Email del contacto"
                  value={editDraft.contact_email}
                  onChange={(e) => setEditDraft(p => ({ ...p, contact_email: e.target.value }))}
                  className="min-h-[44px] w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  aria-label="Teléfono del contacto"
                  value={editDraft.contact_phone}
                  onChange={(e) => setEditDraft(p => ({ ...p, contact_phone: e.target.value }))}
                  className="min-h-[44px] w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Empresa"
                aria-label="Empresa del contacto"
                value={editDraft.contact_company}
                onChange={(e) => setEditDraft(p => ({ ...p, contact_company: e.target.value }))}
                className="min-h-[44px] w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="min-h-[44px] flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="min-h-[44px] flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                >
                  {editSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
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
              <div className="border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Contacto</p>
                  <button
                    type="button"
                    onClick={startEdit}
                    aria-label={contact ? 'Editar contacto y monto' : 'Agregar contacto'}
                    className="inline-flex min-w-[44px] min-h-[44px] items-center justify-center text-zinc-500 hover:text-emerald-400"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                {contact ? (
                  <>
                    <p className="font-bold text-white">{contact.name}</p>
                    {contact.company && <p className="text-xs text-zinc-400">{contact.company}</p>}
                    {contact.email && <p className="text-xs text-zinc-500 mt-1">{contact.email}</p>}
                    {contact.phone && (
                      <a
                        href={`https://wa.me/56${contact.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-1"
                      >
                        <MessageCircle size={14} aria-hidden="true" /> {contact.phone}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">Sin contacto asociado.</p>
                )}
              </div>
            </>
          )}

          {/* Notas */}
          {deal.notes && (
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 whitespace-pre-line">{deal.notes}</div>
          )}

          {/* Actividades */}
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Actividades</p>
            <div className="space-y-2.5 mb-4 max-h-56 overflow-y-auto">
              {activities.length === 0 && <p className="text-xs text-zinc-600">Sin actividades</p>}
              {activities.map(act => {
                const Icon = ActivityIcon[act.type] || StickyNote;
                return (
                <div key={act.id} className="flex gap-2.5 text-sm">
                  <Icon size={16} className="mt-0.5 text-zinc-500 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold text-white text-xs">{act.title}</p>
                    {act.description && <p className="text-zinc-500 text-xs mt-0.5">{act.description}</p>}
                    <p className="text-zinc-600 text-[10px] mt-0.5">{new Date(act.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Form actividad rápida */}
            <div className="border border-zinc-800 rounded-xl p-3 space-y-2.5">
              <div className="flex gap-2">
                <select
                  value={actForm.type}
                  onChange={e => onActFormChange(p => ({ ...p, type: e.target.value }))}
                  aria-label="Tipo de actividad"
                  className="min-h-[44px] bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {Object.keys(ActivityIcon).map(k => <option key={k} value={k}>{activityTypeLabel[k]}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Título *"
                  aria-label="Título de la actividad"
                  value={actForm.title}
                  onChange={e => onActFormChange(p => ({ ...p, title: e.target.value }))}
                  className="min-h-[44px] flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Descripción (opcional)"
                aria-label="Descripción de la actividad"
                value={actForm.description}
                onChange={e => onActFormChange(p => ({ ...p, description: e.target.value }))}
                className="min-h-[44px] w-full bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1.5 text-xs placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <button
                onClick={onAddActivity}
                disabled={actLoading || !actForm.title.trim()}
                className="min-h-[44px] w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition-colors"
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
  const inputClass = 'min-h-[44px] w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors';
  const previouslyFocusedRef = useRef(null);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    firstFieldRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-deal-modal-title"
        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="new-deal-modal-title" className="font-bold text-lg text-white">Nuevo deal</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex min-w-[44px] min-h-[44px] items-center justify-center text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <input ref={firstFieldRef} type="text" placeholder="Nombre del deal *" aria-label="Nombre del deal" value={form.name} onChange={e => onChange(p => ({ ...p, name: e.target.value }))} className={inputClass} />
          <input type="number" placeholder="Monto (CLP)" aria-label="Monto en CLP" value={form.amount_cents} onChange={e => onChange(p => ({ ...p, amount_cents: e.target.value }))} className={inputClass} />
          <select value={form.stage} onChange={e => onChange(p => ({ ...p, stage: e.target.value }))} aria-label="Etapa del deal" className={inputClass}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <p className="block text-xs uppercase tracking-wide text-zinc-500 font-medium pt-1">Contacto (opcional)</p>
          <input type="text" placeholder="Nombre del contacto" aria-label="Nombre del contacto" value={form.contact_name} onChange={e => onChange(p => ({ ...p, contact_name: e.target.value }))} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input type="email" placeholder="Email" aria-label="Email del contacto" value={form.contact_email} onChange={e => onChange(p => ({ ...p, contact_email: e.target.value }))} className={inputClass} />
            <input type="tel" placeholder="Teléfono" aria-label="Teléfono del contacto" value={form.contact_phone} onChange={e => onChange(p => ({ ...p, contact_phone: e.target.value }))} className={inputClass} />
          </div>
          <input type="text" placeholder="Empresa" aria-label="Empresa del contacto" value={form.contact_company} onChange={e => onChange(p => ({ ...p, contact_company: e.target.value }))} className={inputClass} />
          <textarea placeholder="Notas (opcional)" aria-label="Notas del deal" value={form.notes} onChange={e => onChange(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="min-h-[44px] flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
          <button onClick={onSave} disabled={!form.name.trim()} className="min-h-[44px] flex-[2] py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Crear deal</button>
        </div>
      </div>
    </div>
  );
}
