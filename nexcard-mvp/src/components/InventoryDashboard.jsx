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
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminStat from './ui/AdminStat';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';
import AdminBadge from './ui/AdminBadge';

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const movementTone = {
  in: 'success',
  out: 'danger',
  adjust: 'warning',
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
  const [editingMinStock, setEditingMinStock] = useState({}); // { [itemId]: draftValue }

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

  const handleSaveMinStock = async (itemId) => {
    const raw = editingMinStock[itemId];
    if (raw === undefined) return;
    const value = Math.max(0, parseInt(raw, 10) || 0);
    try {
      const { items: updated } = await api.updateInventoryItem(itemId, { min_stock: value });
      setRows(updated);
    } catch {
      // silencioso
    }
    setEditingMinStock(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  };

  const stock = rows;
  const totalValue = stock.reduce((sum, item) => sum + ((item.stock || 0) * (item.cost_cents || 0)), 0);
  const criticalItems = stock.filter(item => (item.stock || 0) <= (item.min_stock || 0)).length;
  const movementCount = movementRows.length;

  const kpis = [
    { label: 'Valorización Stock', value: currency.format(totalValue), accent: null },
    { label: 'Capacidad de Impresión', value: `${stock.filter(item => item.category === 'Tarjetas').reduce((sum, item) => sum + (item.stock || 0), 0)} u`, accent: 'emerald' },
    { label: 'Ítems críticos', value: `${criticalItems}`, accent: criticalItems > 0 ? 'amber' : null },
    { label: 'Movimientos registrados', value: `${movementCount}`, accent: null },
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
    <AdminShell
      active="inventory"
      title="Inventario y Logística"
      subtitle="Control de stock transaccional para producción, impresión y cumplimiento de pedidos"
      actions={
        <button
          onClick={openModal}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          <Plus size={18} /> Registrar Movimiento
        </button>
      }
    >
      {feedback.message && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400' : 'border-red-800 bg-red-950/40 text-red-400'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi, i) => (
          <AdminStat key={i} label={kpi.label} value={kpi.value} accent={kpi.accent} />
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.4fr,1fr] gap-6">
        {/* Tabla de stock */}
        <Table>
          <THead>
            <TH>Item / Maquinaria</TH>
            <TH>Categoría</TH>
            <TH>SKU</TH>
            <TH>Stock Actual</TH>
            <TH>Stock mín.</TH>
            <TH>Costo Unitario</TH>
            <TH>Estado</TH>
            <TH className="text-right">Acciones</TH>
          </THead>
          <tbody className="divide-y divide-zinc-800/60">
            {stock.map((item) => {
              const isLow = (item.min_stock || 0) > 0 && (item.stock || 0) <= (item.min_stock || 0);
              return (
                <TR key={item.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isLow ? 'bg-amber-950/40 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        <Package size={20} />
                      </div>
                      <span className={`font-bold ${isLow ? 'text-amber-400' : 'text-white'}`}>{item.item}</span>
                    </div>
                  </TD>
                  <TD>
                    <span className="text-xs font-bold text-zinc-400">{item.category}</span>
                  </TD>
                  <TD>
                    <span className="text-xs font-bold text-blue-400">{item.sku || 'Sin SKU'}</span>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-lg ${isLow ? 'text-amber-400' : 'text-white'}`}>{item.stock}</span>
                      <span className="text-xs font-bold text-zinc-500">{item.unit}</span>
                      {isLow && (
                        <AdminBadge variant="warning">
                          <AlertTriangle size={10} className="mr-1" /> Bajo stock
                        </AdminBadge>
                      )}
                    </div>
                  </TD>
                  <TD>
                    {editingMinStock[item.id] !== undefined ? (
                      <input
                        type="number"
                        min="0"
                        value={editingMinStock[item.id]}
                        onChange={e => setEditingMinStock(prev => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={() => handleSaveMinStock(item.id)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveMinStock(item.id)}
                        autoFocus
                        className="w-20 px-3 py-2 bg-zinc-900 border border-amber-500 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-amber-500 transition-colors"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingMinStock(prev => ({ ...prev, [item.id]: String(item.min_stock || 0) }))}
                        className={`text-sm font-bold px-3 py-1 rounded-lg border border-dashed transition-colors ${(item.min_stock || 0) > 0 ? 'border-amber-700 text-amber-400 bg-amber-950/30 hover:bg-amber-950/50' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}`}
                        title="Click para editar stock mínimo"
                      >
                        {(item.min_stock || 0) > 0 ? item.min_stock : '—'}
                      </button>
                    )}
                  </TD>
                  <TD className="font-bold text-zinc-300">{currency.format(item.cost_cents || 0)}</TD>
                  <TD>
                    <AdminBadge variant={isLow ? 'danger' : 'success'}>
                      {isLow ? 'Stock Crítico' : 'OK'}
                    </AdminBadge>
                  </TD>
                  <TD className="text-right">
                    <button
                      onClick={() => { setForm((prev) => ({ ...prev, inventory_item_id: item.id })); setIsModalOpen(true); }}
                      className="p-2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <Settings size={20} />
                    </button>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>

        {/* Últimos movimientos */}
        <AdminCard>
          <h3 className="font-bold text-lg text-white mb-4">Últimos movimientos</h3>
          <div className="space-y-3 max-h-[540px] overflow-auto pr-1">
            {movementRows.length > 0 ? movementRows.slice(0, 12).map((movement) => {
              const item = movementItemsById[movement.inventory_item_id];
              return (
                <div key={movement.id} className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-sm text-white">{item?.item || movement.inventory_item_id}</p>
                      <p className="text-xs text-zinc-500 font-medium mt-1">{movement.reason || 'Sin motivo'}</p>
                    </div>
                    <AdminBadge variant={movementTone[movement.movement_type] || 'default'}>
                      {movement.movement_type === 'in' && <ArrowDownCircle size={12} className="mr-1" />}
                      {movement.movement_type === 'out' && <ArrowUpCircle size={12} className="mr-1" />}
                      {movement.movement_type === 'adjust' && <SlidersHorizontal size={12} className="mr-1" />}
                      {movement.movement_type}
                    </AdminBadge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-500">
                    <span>{movement.quantity} u</span>
                    <span>{formatDate(movement.created_at)}</span>
                  </div>
                  {movement.order_id && <p className="text-[11px] font-bold text-zinc-500 mt-2">Orden: {movement.order_id}</p>}
                </div>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm font-medium text-zinc-500">
                No hay movimientos registrados todavía.
              </div>
            )}
          </div>
        </AdminCard>
      </div>

      {/* Banner operativo */}
      <AdminCard className="mt-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Printer size={40} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">Operación de stock</h4>
            <p className="text-zinc-400 font-medium text-sm">MVP transaccional activo: entradas, salidas y ajustes manuales con rastro.</p>
            <div className="mt-2 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[72%]"></div>
            </div>
          </div>
        </div>
        <div className="flex gap-4 shrink-0">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Costo detenido</p>
            <p className="text-2xl font-bold text-white">{currency.format(totalValue)}</p>
          </div>
          <div className="w-px h-12 bg-zinc-700"></div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">Riesgo stock</p>
            <p className="text-2xl font-bold text-white">{criticalItems}</p>
          </div>
        </div>
      </AdminCard>

      {/* Panel: Configuración de insumos por despacho */}
      <AdminCard className="mt-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-zinc-800 text-blue-400">
            <Truck size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Insumos por despacho</h3>
            <p className="text-sm text-zinc-400 font-medium">Se descuentan automáticamente al marcar una orden como despachada.</p>
          </div>
        </div>

        {dispatchFeedback.message && (
          <div className={`mb-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${dispatchFeedback.type === 'success' ? 'border-emerald-800 bg-emerald-950/40 text-emerald-400' : 'border-red-800 bg-red-950/40 text-red-400'}`}>
            {dispatchFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{dispatchFeedback.message}</span>
          </div>
        )}

        {dispatchConfigs.length > 0 ? (
          <div className="mb-6">
            <Table>
              <THead>
                <TH>Item</TH>
                <TH>SKU</TH>
                <TH>Cantidad por despacho</TH>
                <TH>Descripción</TH>
                <TH>Estado</TH>
                <TH></TH>
              </THead>
              <tbody className="divide-y divide-zinc-800/60">
                {dispatchConfigs.map((config) => (
                  <TR key={config.id}>
                    <TD className="font-bold text-white">{config.inventory_items?.item || '—'}</TD>
                    <TD><span className="text-xs font-bold text-blue-400">{config.inventory_items?.sku || '—'}</span></TD>
                    <TD className="font-bold text-white">{config.quantity_per_dispatch}</TD>
                    <TD className="text-zinc-400">{config.description || '—'}</TD>
                    <TD>
                      <AdminBadge variant={config.active ? 'success' : 'default'}>
                        {config.active ? 'Activo' : 'Inactivo'}
                      </AdminBadge>
                    </TD>
                    <TD>
                      <button
                        onClick={() => handleDeleteDispatchConfig(config.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm font-medium text-zinc-500 mb-6">
            No hay insumos configurados. Agrega los materiales que se consumen en cada despacho.
          </div>
        )}

        <form onSubmit={handleAddDispatchConfig} className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Item de inventario</label>
            <select
              value={dispatchForm.inventory_item_id}
              onChange={(e) => setDispatchForm(prev => ({ ...prev, inventory_item_id: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              required
            >
              <option value="">Seleccionar item</option>
              {rows.map((item) => (
                <option key={item.id} value={item.id}>{item.item} ({item.stock} {item.unit})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Cantidad por despacho</label>
            <input
              type="number"
              min="1"
              value={dispatchForm.quantity_per_dispatch}
              onChange={(e) => setDispatchForm(prev => ({ ...prev, quantity_per_dispatch: e.target.value }))}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Descripción (opcional)</label>
            <input
              type="text"
              value={dispatchForm.description}
              onChange={(e) => setDispatchForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Ej: Caja de envío estándar"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={dispatchSaving || !dispatchForm.inventory_item_id}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {dispatchSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Agregar
          </button>
        </form>
      </AdminCard>

      {/* Modal registrar movimiento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Registrar movimiento</h3>
                <p className="text-sm text-zinc-400 font-medium">Entrada, salida o ajuste manual con actualización inmediata de stock.</p>
              </div>
              <button onClick={closeModal} className="p-2 text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Item</span>
                <select
                  value={form.inventory_item_id}
                  onChange={(event) => handleChange('inventory_item_id', event.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                >
                  {rows.map((item) => (
                    <option key={item.id} value={item.id}>{item.item} ({item.stock} {item.unit})</option>
                  ))}
                </select>
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Tipo</span>
                  <select
                    value={form.movement_type}
                    onChange={(event) => handleChange('movement_type', event.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                  >
                    <option value="in">Entrada</option>
                    <option value="out">Salida</option>
                    <option value="adjust">Ajuste</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Cantidad</span>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) => handleChange('quantity', event.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Motivo</span>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(event) => handleChange('reason', event.target.value)}
                  placeholder="Compra proveedor, batch producción, ajuste manual..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </label>

              <label className="block">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Order ID (opcional)</span>
                <input
                  type="text"
                  value={form.order_id}
                  onChange={(event) => handleChange('order_id', event.target.value)}
                  placeholder="Asociar salida a una orden si aplica"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </label>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Registrar movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
};

export default InventoryDashboard;
