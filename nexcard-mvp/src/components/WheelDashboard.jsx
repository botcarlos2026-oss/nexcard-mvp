import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, BarChart2, X, Loader2, RefreshCw } from 'lucide-react';
import AdminShell from './AdminShell';
import { api } from '../services/api';

const PRIZE_TYPES = [
  { value: 'discount_percent', label: '% Descuento' },
  { value: 'discount_amount', label: 'Monto fijo (CLP)' },
  { value: 'free_shipping', label: 'Envío gratis' },
  { value: 'free_product', label: 'Producto gratis' },
  { value: 'other', label: 'Otro' },
];

const PRIZE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6', '#F97316'];

const EMPTY_PRIZE = { label: '', type: 'discount_percent', value: 0, coupon_code: '', weight: 10, color: '#10B981', display_order: 0, active: true };

function PrizeRow({ prize, index, onChange, onRemove }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400">Premio {index + 1}</span>
        <button onClick={onRemove} className="text-zinc-500 hover:text-red-400 transition-colors"><X size={14} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Label *</label>
          <input className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" value={prize.label} onChange={e => onChange('label', e.target.value)} placeholder="10% descuento" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Tipo</label>
          <select className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" value={prize.type} onChange={e => onChange('type', e.target.value)}>
            {PRIZE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Valor</label>
          <input type="number" min={0} className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" value={prize.value} onChange={e => onChange('value', Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Código cupón</label>
          <input className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" value={prize.coupon_code} onChange={e => onChange('coupon_code', e.target.value.toUpperCase())} placeholder="NEXCARD10" />
        </div>
      </div>
      <div>
        <label className="text-xs text-zinc-500 mb-1 block">Peso: {prize.weight} (probabilidad ≈ {prize.weight}%)</label>
        <input type="range" min={1} max={100} value={prize.weight} onChange={e => onChange('weight', Number(e.target.value))} className="w-full accent-emerald-500" />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-500">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {PRIZE_COLORS.map(c => (
            <button key={c} type="button" onClick={() => onChange('color', c)} className={`w-5 h-5 rounded-full border-2 transition-all ${prize.color === c ? 'border-white scale-125' : 'border-transparent'}`} style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={prize.color} onChange={e => onChange('color', e.target.value)} className="w-5 h-5 rounded-full border-2 border-zinc-600 cursor-pointer overflow-hidden bg-transparent p-0" />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Activo</span>
          <button type="button" onClick={() => onChange('active', !prize.active)} className={`w-8 h-4 rounded-full transition-colors relative ${prize.active ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${prize.active ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function WheelModal({ wheel, onSave, onClose }) {
  const [form, setForm] = useState(wheel ? {
    name: wheel.name, active: wheel.active, banner_title: wheel.banner_title,
    banner_subtitle: wheel.banner_subtitle, show_on_first_visit: wheel.show_on_first_visit,
    show_floating_button: wheel.show_floating_button,
    start_date: wheel.start_date?.slice(0, 16) || '', end_date: wheel.end_date?.slice(0, 16) || '',
  } : {
    name: '', active: false, banner_title: 'Gira la ruleta',
    banner_subtitle: 'Premio garantizado en tu primera compra',
    show_on_first_visit: true, show_floating_button: true, start_date: '', end_date: '',
  });
  const [prizes, setPrizes] = useState(
    wheel ? (wheel.wheel_prizes || []).map(p => ({ ...p })) :
    PRIZE_COLORS.slice(0, 6).map((c, i) => ({ ...EMPTY_PRIZE, color: c, display_order: i, label: `Premio ${i + 1}`, coupon_code: `NEXCARD${i + 1}` }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updatePrize = (index, key, value) => {
    setPrizes(prev => prev.map((p, i) => i === index ? { ...p, [key]: value } : p));
  };

  const addPrize = () => {
    if (prizes.length >= 8) return;
    setPrizes(prev => [...prev, { ...EMPTY_PRIZE, color: PRIZE_COLORS[prev.length % PRIZE_COLORS.length], display_order: prev.length }]);
  };

  const removePrize = (index) => {
    if (prizes.length <= 4) return;
    setPrizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return; }
    if (prizes.filter(p => p.active).length < 2) { setError('Necesitas al menos 2 premios activos'); return; }
    setLoading(true);
    setError('');
    try {
      const config = {
        ...form,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      if (wheel) {
        await api.updateWheel(wheel.id, config);
        for (const p of prizes) {
          if (p.id) await api.updateWheelPrize(p.id, { label: p.label, type: p.type, value: p.value, coupon_code: p.coupon_code || null, weight: p.weight, color: p.color, display_order: p.display_order, active: p.active });
          else await api.createWheelPrize({ ...p, wheel_id: wheel.id, coupon_code: p.coupon_code || null });
        }
      } else {
        const created = await api.createWheel(config);
        for (const p of prizes) {
          await api.createWheelPrize({ ...p, wheel_id: created.id, coupon_code: p.coupon_code || null });
        }
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="font-bold text-lg">{wheel ? 'Editar ruleta' : 'Crear ruleta'}</h2>
          <button onClick={onClose}><X size={20} className="text-zinc-500 hover:text-white transition-colors" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && <p className="text-red-400 text-sm bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Nombre interno *</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Ruleta Lanzamiento Mayo" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Título banner</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.banner_title} onChange={e => setField('banner_title', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Subtítulo banner</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.banner_subtitle} onChange={e => setField('banner_subtitle', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Inicio (opcional)</label>
              <input type="datetime-local" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Fin (opcional)</label>
              <input type="datetime-local" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'active', label: 'Activa' },
              { key: 'show_on_first_visit', label: 'Mostrar en primera visita' },
              { key: 'show_floating_button', label: 'Botón flotante 🎁' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <button type="button" onClick={() => setField(key, !form[key])} className={`w-10 h-5 rounded-full transition-colors relative ${form[key] ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form[key] ? 'left-5' : 'left-0.5'}`} />
                </button>
                <span className="text-sm text-zinc-300">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Premios ({prizes.length}/8)</h3>
              <button type="button" onClick={addPrize} disabled={prizes.length >= 8} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40 flex items-center gap-1">
                <Plus size={14} /> Agregar
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {prizes.map((prize, i) => (
                <PrizeRow key={i} prize={prize} index={i} onChange={(k, v) => updatePrize(i, k, v)} onRemove={() => removePrize(i)} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-[2] py-2.5 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Guardar ruleta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatsModal({ wheel, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getWheelStats(wheel.id).then(({ spins }) => {
      setStats(spins);
      setLoading(false);
    });
  }, [wheel.id]);

  const prizeCounts = stats?.reduce((acc, s) => {
    const label = s.wheel_prizes?.label || 'Desconocido';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {}) || {};
  const maxCount = Math.max(1, ...Object.values(prizeCounts));
  const totalSpins = stats?.length || 0;
  const redeemed = stats?.filter(s => s.redeemed).length || 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="font-bold">Stats: {wheel.name}</h2>
          <button onClick={onClose}><X size={20} className="text-zinc-500 hover:text-white" /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-zinc-600" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-zinc-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-emerald-400">{totalSpins}</p>
                  <p className="text-xs text-zinc-500 mt-1">Total giros</p>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-blue-400">{redeemed}</p>
                  <p className="text-xs text-zinc-500 mt-1">Canjeados</p>
                </div>
                <div className="bg-zinc-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-yellow-400">{totalSpins > 0 ? Math.round(redeemed / totalSpins * 100) : 0}%</p>
                  <p className="text-xs text-zinc-500 mt-1">Tasa canje</p>
                </div>
              </div>

              {Object.entries(prizeCounts).length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-bold mb-3">Distribución de premios</h3>
                  <div className="space-y-2">
                    {Object.entries(prizeCounts).map(([label, count]) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 w-28 truncate">{label}</span>
                        <div className="flex-1 bg-zinc-800 rounded h-2">
                          <div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-xs text-zinc-400 w-5 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats?.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-3">Últimos giros</h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {stats.slice(0, 50).map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs bg-zinc-800 rounded-lg px-3 py-2">
                        <span className="text-zinc-300 truncate max-w-[160px]">{s.wheel_prizes?.label || '—'}</span>
                        <span className="text-zinc-500">{s.email || 'Sin email'}</span>
                        <span className={s.redeemed ? 'text-emerald-400' : 'text-zinc-600'}>{s.redeemed ? '✓ Canjeado' : 'Pendiente'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WheelDashboard() {
  const [wheels, setWheels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [statsWheel, setStatsWheel] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { wheels: data } = await api.getAllWheels();
      setWheels(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await api.deleteWheel(id);
      setWheels(prev => prev.filter(w => w.id !== id));
    } finally {
      setSaving(false);
      setDeleteId(null);
    }
  };

  const handleToggleActive = async (wheel) => {
    try {
      await api.updateWheel(wheel.id, { active: !wheel.active });
      setWheels(prev => prev.map(w => w.id === wheel.id ? { ...w, active: !w.active } : w));
    } catch { /* silencioso */ }
  };

  return (
    <AdminShell
      active="wheel"
      title="Ruleta de descuentos"
      subtitle="Incentivos gamificados para primera compra"
      actions={
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-zinc-400 hover:text-white transition-colors"><RefreshCw size={18} /></button>
          <button onClick={() => setModal('create')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors">
            <Plus size={16} /> Nueva ruleta
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-zinc-600" /></div>
      ) : wheels.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-5xl mb-4">🎰</p>
          <p className="text-xl font-bold mb-2">Sin ruletas</p>
          <p className="text-sm mb-5">Crea tu primera ruleta de descuentos.</p>
          <button onClick={() => setModal('create')} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors">
            Crear ruleta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wheels.map(wheel => {
            const activePrizes = (wheel.wheel_prizes || []).filter(p => p.active).length;
            const totalPrizes = (wheel.wheel_prizes || []).length;
            return (
              <div key={wheel.id} className={`bg-zinc-900 border rounded-xl p-5 transition-colors ${wheel.active ? 'border-emerald-800' : 'border-zinc-800'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm">{wheel.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{activePrizes}/{totalPrizes} premios activos</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${wheel.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-500'}`}>
                    {wheel.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                <div className="text-xs text-zinc-500 space-y-1 mb-4">
                  <p>📣 {wheel.banner_title}</p>
                  {wheel.start_date && <p>📅 Desde {new Date(wheel.start_date).toLocaleDateString('es-CL')}</p>}
                  {wheel.end_date && <p>🏁 Hasta {new Date(wheel.end_date).toLocaleDateString('es-CL')}</p>}
                  {wheel.show_on_first_visit && <p>👋 Aparece en primera visita</p>}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleActive(wheel)} className={`w-10 h-5 rounded-full transition-colors relative ${wheel.active ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${wheel.active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setStatsWheel(wheel)} className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors"><BarChart2 size={14} /></button>
                    <button onClick={() => setModal(wheel)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteId(wheel.id)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <WheelModal
          wheel={modal === 'create' ? null : modal}
          onSave={load}
          onClose={() => setModal(null)}
        />
      )}

      {statsWheel && <StatsModal wheel={statsWheel} onClose={() => setStatsWheel(null)} />}

      {deleteId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDeleteId(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">¿Eliminar ruleta?</h3>
            <p className="text-zinc-400 text-sm mb-5">Se eliminarán también todos los premios y registros de giros.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-zinc-700 text-zinc-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
