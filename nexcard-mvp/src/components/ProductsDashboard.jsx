import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Star, StarOff, ToggleLeft, ToggleRight, X, AlertTriangle } from 'lucide-react';
import AdminShell from './AdminShell';
import { api } from '../services/api';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const STATUS_BADGE = {
  active:   'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  inactive: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  archived: 'bg-red-900/30 text-red-400 border border-red-800',
};

const EMPTY_FORM = {
  sku: '',
  name: '',
  description: '',
  price_cents: '',
  status: 'active',
  popular: false,
  display_order: 0,
  features: [],
};

function validate(form, existingSkus, editingId) {
  const errs = {};
  const sku = form.sku.trim().toUpperCase();
  if (!sku) errs.sku = 'SKU requerido';
  else if (!/^[A-Z0-9-]+$/.test(sku)) errs.sku = 'Solo letras, números y guiones (ej: PREMIUM-5)';
  else if (existingSkus.filter(s => s.id !== editingId).some(s => s.sku === sku)) errs.sku = 'SKU ya existe';

  if (!form.name.trim() || form.name.trim().length < 3) errs.name = 'Mínimo 3 caracteres';

  const price = Number(form.price_cents);
  if (!price || price < 1000) errs.price_cents = 'Precio mínimo $1.000 CLP';

  return errs;
}

function FeaturesList({ features, onChange }) {
  const add = () => onChange([...features, '']);
  const remove = (i) => onChange(features.filter((_, idx) => idx !== i));
  const update = (i, val) => onChange(features.map((f, idx) => idx === i ? val : f));

  return (
    <div className="space-y-2">
      {features.map((f, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={f}
            onChange={e => update(i, e.target.value)}
            placeholder={`Característica ${i + 1}`}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <button type="button" onClick={() => remove(i)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
      >
        <Plus size={14} /> Agregar característica
      </button>
    </div>
  );
}

function ProductModal({ product, existingSkus, onSave, onClose }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState(isEdit ? { ...product, features: product.features || [] } : EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form, existingSkus, product?.id);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        price_cents: Number(form.price_cents),
        display_order: Number(form.display_order) || 0,
        features: form.features.filter(f => f.trim()),
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-lg font-bold">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">SKU *</label>
              <input
                value={form.sku}
                onChange={e => set('sku', e.target.value.toUpperCase())}
                placeholder="PREMIUM-5"
                className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${errors.sku ? 'border-red-500' : 'border-zinc-700'}`}
              />
              {errors.sku && <p className="text-red-400 text-xs mt-1">{errors.sku}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Precio CLP *</label>
              <input
                type="number"
                value={form.price_cents}
                onChange={e => set('price_cents', e.target.value)}
                placeholder="79990"
                min="1000"
                className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${errors.price_cents ? 'border-red-500' : 'border-zinc-700'}`}
              />
              {errors.price_cents && <p className="text-red-400 text-xs mt-1">{errors.price_cents}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Nombre *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Plan Premium"
              className={`w-full bg-zinc-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 ${errors.name ? 'border-red-500' : 'border-zinc-700'}`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Descripción</label>
            <textarea
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Descripción breve del producto"
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Estado</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Orden visualización</label>
              <input
                type="number"
                value={form.display_order}
                onChange={e => set('display_order', e.target.value)}
                min="0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <div>
              <p className="text-sm font-medium">Más popular</p>
              <p className="text-xs text-zinc-500">Muestra el badge "Más popular" en la landing</p>
            </div>
            <button
              type="button"
              onClick={() => set('popular', !form.popular)}
              className={`transition-colors ${form.popular ? 'text-yellow-400' : 'text-zinc-600'}`}
            >
              {form.popular ? <Star size={22} fill="currentColor" /> : <StarOff size={22} />}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Características</label>
            <FeaturesList features={form.features} onChange={val => set('features', val)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ product, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 text-center">
        <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold mb-1">Eliminar producto</h3>
        <p className="text-zinc-400 text-sm mb-5">
          ¿Eliminar <span className="text-white font-medium">{product.name}</span> ({product.sku})?
          Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsDashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', product? }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [orderEdits, setOrderEdits] = useState({});

  const load = useCallback(async () => {
    try {
      const { products: data } = await api.getAllProducts();
      setProducts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (payload) => {
    try {
      if (modal?.product?.id) {
        await api.updateProduct(modal.product.id, payload);
      } else {
        await api.createProduct(payload);
      }
      setModal(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleToggleStatus = async (p) => {
    const next = p.status === 'active' ? 'inactive' : 'active';
    try {
      await api.toggleProductStatus(p.id, next);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleTogglePopular = async (p) => {
    try {
      await api.updateProduct(p.id, { popular: !p.popular });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleOrderBlur = async (p) => {
    const val = orderEdits[p.id];
    if (val === undefined || Number(val) === p.display_order) return;
    try {
      await api.updateProduct(p.id, { display_order: Number(val) });
      setOrderEdits(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const active = products.filter(p => p.status === 'active').length;
  const inactive = products.filter(p => p.status !== 'active').length;
  const avgPrice = products.length
    ? Math.round(products.reduce((s, p) => s + (p.price_cents || 0), 0) / products.length)
    : 0;

  const existingSkus = products.map(p => ({ id: p.id, sku: p.sku }));

  return (
    <AdminShell
      active="products"
      title="Planes y precios"
      subtitle="Gestiona los productos visibles en la landing"
      actions={
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-colors"
        >
          <Plus size={16} /> Nuevo producto
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total productos', value: products.length },
          { label: 'Activos', value: active, color: 'text-emerald-400' },
          { label: 'Inactivos', value: inactive, color: 'text-zinc-400' },
          { label: 'Precio promedio', value: formatCLP(avgPrice), color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-zinc-500 text-sm py-12 text-center">Cargando productos…</div>
      ) : products.length === 0 ? (
        <div className="text-zinc-500 text-sm py-12 text-center">
          No hay productos. <button onClick={() => setModal({ mode: 'create' })} className="text-emerald-400 hover:underline">Crear el primero</button>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['SKU', 'Nombre', 'Precio', 'Estado', 'Popular', 'Orden', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300 whitespace-nowrap">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{p.name}</td>
                    <td className="px-4 py-3 text-emerald-400 font-semibold whitespace-nowrap">{formatCLP(p.price_cents)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[p.status] || STATUS_BADGE.inactive}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTogglePopular(p)}
                        title={p.popular ? 'Quitar "Más popular"' : 'Marcar como "Más popular"'}
                        className={`transition-colors ${p.popular ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                      >
                        <Star size={16} fill={p.popular ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={orderEdits[p.id] !== undefined ? orderEdits[p.id] : (p.display_order ?? 0)}
                        onChange={e => setOrderEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={() => handleOrderBlur(p)}
                        className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setModal({ mode: 'edit', product: p })}
                          title="Editar"
                          className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded hover:bg-zinc-700"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(p)}
                          title={p.status === 'active' ? 'Desactivar' : 'Activar'}
                          className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded hover:bg-zinc-700"
                        >
                          {p.status === 'active' ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          title="Eliminar"
                          className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors rounded hover:bg-zinc-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <ProductModal
          product={modal.product}
          existingSkus={existingSkus}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          product={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </AdminShell>
  );
}
