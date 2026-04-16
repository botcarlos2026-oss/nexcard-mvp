import React, { useMemo, useState, useEffect } from 'react';
import {
  Package,
  Printer,
  ShoppingCart,
  AlertTriangle,
  BarChart3,
  Settings,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  SlidersHorizontal,
  CheckCircle2,
  Loader2,
  X,
  Truck,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const movementTone = {
  in: 'bg-emerald-100 text-emerald-700',
  out: 'bg-rose-100 text-rose-700',
  adjust: 'bg-amber-100 text-amber-700',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CL');
};

const InventoryDashboard = ({ items = [], movements = [] }) => {
  const [rows, setRows] = useState(items);
  const [movementRows, setMovementRows] = useState(movements);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [form, setForm] = useState({
    inventory_item_id: items[0]?.id || '',
    movement_type: 'in',
    quantity: 1,
    reason: '',
    order_id: '',
  });

  const [dispatchConfigs, setDispatchConfigs] = useState([]);
  const [dispatchForm, setDispatchForm] = useState({ inventory_item_id: '', quantity_per_dispatch: 1, description: '' });
  const [dispatchSaving, setDispatchSaving] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    api.getDispatchConfig().then(setDispatchConfigs).catch(() => {});
  }, []);

  const handleAddDispatchConfig = async (e) => {
    e.preventDefault();
    if (!dispatchForm.inventory_item_id) return;
    setDispatchSaving(true);
    setDispatchFeedback({ type: '', message: '' });
    try {
      const updated = await api.addDispatchConfig(dispatchForm);
      setDispatchConfigs(updated);
      setDispatchForm({ inventory_item_id: '', quantity_per_dispatch: 1, description: '' });
      setDispatchFeedback({ type: 'success', message: 'Insumo agregado a la configuración de despacho.' });
    } catch (err) {
      setDispatchFeedback({ type: 'error', message: err.message || 'No se pudo guardar.' });
    } finally {
      setDispatchSaving(false);
    }
  };

  const handleDeleteDispatchConfig = async (id) => {
    try {
      const updated = await api.deleteDispatchConfig(id);
      setDispatchConfigs(updated);
    } catch (err) {
      setDispatchFeedback({ type: 'error', message: err.message || 'No se pudo eliminar.' });
    }
  };

  const stock = rows;
  const totalValue = stock.reduce((sum, item) => sum + ((item.stock || 0) * (item.cost_cents || 0)), 0);
  const criticalItems = stock.filter(item => (item.stock || 0) <= (item.min_stock || 0)).length;
  const movementCount = movementRows.length;

  const kpis = [
    { label: 'Valorización Stock', value: currency.format(totalValue), icon: BarChart3, color: 'text-blue-500' },
    { label: 'Capacidad de Impresión', value: `${stock.filter(item => item.category === 'Tarjetas').reduce((sum, item) => sum + (item.stock || 0), 0)} u`, icon: Printer, color: 'text-emerald-500' },
    { label: 'Ítems críticos', value: `${criticalItems}`, icon: ShoppingCart, color: 'text-amber-500' },
    { label: 'Movimientos registrados', value: `${movementCount}`, icon: SlidersHorizontal, color: 'text-violet-500' },
  ];

  const movementItemsById = useMemo(() => rows.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {}), [rows]);

  const openModal = () => {
    setForm((prev) => ({ ...prev, inventory_item_id: rows[0]?.id || prev.inventory_item_id || '' }));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFeedback((prev) => prev.type === 'error' ? prev : { type: '', message: '' });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const inventory = await api.createInventoryMovement({
        ...form,
        quantity: Number(form.quantity),
        order_id: form.order_id || null,
      });

      setRows(inventory.items || []);
      setMovementRows(inventory.movements || []);
      setFeedback({ type: 'success', message: 'Movimiento registrado y stock actualizado.' });
      setForm({
        inventory_item_id: inventory.items?.[0]?.id || '',
        movement_type: 'in',
        quantity: 1,
        reason: '',
        order_id: '',
      });
      setIsModalOpen(false);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message || 'No fue posible registrar el movimiento.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 bg-zinc-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Inventario y Logística</h1>
            <p className="text-zinc-500 font-medium">Control de stock transaccional para producción, impresión y cumplimiento de pedidos</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href="/admin/orders" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Órdenes</a>
            <button onClick={openModal} className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:scale-105 transition-all inline-flex items-center gap-2">
              <Plus size={18} /> Registrar Movimiento
            </button>
          </div>
        </div>

        {feedback.message && (
          <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          {kpis.map((kpi, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
              <div className="p-3 rounded-2xl bg-zinc-50 inline-block mb-4">
                <kpi.icon className={kpi.color} size={24} />
              </div>
              <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">{kpi.label}</p>
              <h3 className="text-3xl font-black mt-1">{kpi.value}</h3>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6">
          <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-8 py-4">Item / Maquinaria</th>
                  <th className="px-8 py-4">Categoría</th>
                  <th className="px-8 py-4">SKU</th>
                  <th className="px-8 py-4">Stock Actual</th>
                  <th className="px-8 py-4">Costo Unitario</th>
                  <th className="px-8 py-4">Estado</th>
                  <th className="px-8 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {stock.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/20 transition-all">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 rounded-xl text-zinc-400">
                          <Package size={20} />
                        </div>
                        <span className="font-bold text-zinc-950">{item.item}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-zinc-400">{item.category}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-sky-600">{item.sku || 'Sin SKU'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg">{item.stock}</span>
                        <span className="text-xs font-bold text-zinc-400">{item.unit}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-zinc-700">{currency.format(item.cost_cents || 0)}</td>
                    <td className="px-8 py-5">
                      {(item.stock || 0) <= (item.min_stock || 0) ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase">
                          <AlertTriangle size={12} /> Stock Crítico
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">
                          OK
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button onClick={() => { setForm((prev) => ({ ...prev, inventory_item_id: item.id })); setIsModalOpen(true); }} className="p-2 text-zinc-400 hover:text-zinc-950 transition-colors">
                        <Settings size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm p-6">
            <h3 className="font-black text-lg mb-4">Últimos movimientos</h3>
            <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
              {movementRows.length > 0 ? movementRows.slice(0, 12).map((movement) => {
                const item = movementItemsById[movement.inventory_item_id];
                return (
                  <div key={movement.id} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-sm text-zinc-950">{item?.item || movement.inventory_item_id}</p>
                        <p className="text-xs text-zinc-500 font-medium mt-1">{movement.reason || 'Sin motivo'}</p>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${movementTone[movement.movement_type] || 'bg-zinc-100 text-zinc-700'}`}>
                        {movement.movement_type === 'in' && <ArrowDownCircle size={12} />}
                        {movement.movement_type === 'out' && <ArrowUpCircle size={12} />}
                        {movement.movement_type === 'adjust' && <SlidersHorizontal size={12} />}
                        {movement.movement_type}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <span>{movement.quantity} u</span>
                      <span>{formatDate(movement.created_at)}</span>
                    </div>
                    {movement.order_id && <p className="text-[11px] font-bold text-zinc-500 mt-2">Orden: {movement.order_id}</p>}
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm font-medium text-zinc-500">
                  No hay movimientos registrados todavía.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 p-8 rounded-[32px] bg-zinc-900 text-white flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[24px] bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Printer size={40} />
            </div>
            <div>
              <h4 className="text-xl font-black">Operación de stock</h4>
              <p className="text-zinc-400 font-medium">MVP transaccional activo: entradas, salidas y ajustes manuales con rastro.</p>
              <div className="mt-2 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[72%]"></div>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Costo detenido</p>
              <p className="text-2xl font-black">{currency.format(totalValue)}</p>
            </div>
            <div className="w-px h-12 bg-zinc-800"></div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Riesgo stock</p>
              <p className="text-2xl font-black">{criticalItems}</p>
            </div>
          </div>
        </div>

        {/* Panel: Configuración de insumos por despacho */}
        <div className="mt-8 bg-white rounded-[32px] border border-zinc-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-zinc-50 text-violet-500">
              <Truck size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-zinc-950">Insumos por despacho</h3>
              <p className="text-sm text-zinc-500 font-medium">Se descuentan automáticamente al marcar una orden como despachada.</p>
            </div>
          </div>

          {dispatchFeedback.message && (
            <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${dispatchFeedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
              {dispatchFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{dispatchFeedback.message}</span>
            </div>
          )}

          {dispatchConfigs.length > 0 ? (
            <table className="w-full text-left mb-6">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Cantidad por despacho</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {dispatchConfigs.map((config) => (
                  <tr key={config.id} className="hover:bg-zinc-50/30">
                    <td className="px-4 py-4 font-bold text-zinc-950">{config.inventory_items?.item || '—'}</td>
                    <td className="px-4 py-4 text-xs font-bold text-sky-600">{config.inventory_items?.sku || '—'}</td>
                    <td className="px-4 py-4 font-black text-zinc-950">{config.quantity_per_dispatch}</td>
                    <td className="px-4 py-4 text-sm text-zinc-500">{config.description || '—'}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${config.active ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {config.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => handleDeleteDispatchConfig(config.id)} className="p-2 text-zinc-400 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-5 text-sm font-medium text-zinc-500 mb-6">
              No hay insumos configurados. Agrega los materiales que se consumen en cada despacho.
            </div>
          )}

          <form onSubmit={handleAddDispatchConfig} className="grid sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-1.5">Item de inventario</label>
              <select
                value={dispatchForm.inventory_item_id}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, inventory_item_id: e.target.value }))}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                required
              >
                <option value="">Seleccionar item</option>
                {rows.map((item) => (
                  <option key={item.id} value={item.id}>{item.item} ({item.stock} {item.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-1.5">Cantidad por despacho</label>
              <input
                type="number"
                min="1"
                value={dispatchForm.quantity_per_dispatch}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, quantity_per_dispatch: e.target.value }))}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-1.5">Descripción (opcional)</label>
              <input
                type="text"
                value={dispatchForm.description}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ej: Caja de envío estándar"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={dispatchSaving || !dispatchForm.inventory_item_id}
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-violet-500 text-white font-black text-sm shadow-lg shadow-violet-200 disabled:opacity-50"
            >
              {dispatchSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Agregar
            </button>
          </form>
        </div>

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-2xl border border-zinc-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-zinc-950">Registrar movimiento</h3>
                <p className="text-sm text-zinc-500 font-medium">Entrada, salida o ajuste manual con actualización inmediata de stock.</p>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-400 hover:text-zinc-950 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Item</span>
                <select value={form.inventory_item_id} onChange={(event) => handleChange('inventory_item_id', event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20">
                  {rows.map((item) => (
                    <option key={item.id} value={item.id}>{item.item} ({item.stock} {item.unit})</option>
                  ))}
                </select>
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Tipo</span>
                  <select value={form.movement_type} onChange={(event) => handleChange('movement_type', event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20">
                    <option value="in">Entrada</option>
                    <option value="out">Salida</option>
                    <option value="adjust">Ajuste</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Cantidad</span>
                  <input type="number" min="1" value={form.quantity} onChange={(event) => handleChange('quantity', event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Motivo</span>
                <input type="text" value={form.reason} onChange={(event) => handleChange('reason', event.target.value)} placeholder="Compra proveedor, batch producción, ajuste manual..." className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Order ID (opcional)</span>
                <input type="text" value={form.order_id} onChange={(event) => handleChange('order_id', event.target.value)} placeholder="Asociar salida a una orden si aplica" className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </label>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-3 rounded-2xl border border-zinc-200 text-zinc-700 font-bold text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-200 inline-flex items-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Registrar movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryDashboard;
