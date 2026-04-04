import React from 'react';
import {
  Package,
  Printer,
  ShoppingCart,
  AlertTriangle,
  BarChart3,
  Settings
} from 'lucide-react';

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const InventoryDashboard = ({ items = [] }) => {
  const stock = items;
  const totalValue = stock.reduce((sum, item) => sum + ((item.stock || 0) * (item.cost_cents ? item.cost_cents / 100 : 0)), 0);
  const criticalItems = stock.filter(item => (item.stock || 0) <= (item.min_stock || 0)).length;

  const kpis = [
    { label: 'Valorización Stock', value: currency.format(totalValue), icon: BarChart3, color: 'text-blue-500' },
    { label: 'Capacidad de Impresión', value: `${stock.filter(item => item.category === 'Tarjetas').reduce((sum, item) => sum + (item.stock || 0), 0)} u`, icon: Printer, color: 'text-emerald-500' },
    { label: 'Ítems críticos', value: `${criticalItems}`, icon: ShoppingCart, color: 'text-amber-500' },
  ];

  return (
    <div className="p-8 bg-zinc-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Inventario y Logística</h1>
            <p className="text-zinc-500 font-medium">Control de stock para producción, impresión y cumplimiento de pedidos</p>
          </div>
          <button className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:scale-105 transition-all">
            + Registrar Entrada/Compra
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
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

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                <th className="px-8 py-4">Item / Maquinaria</th>
                <th className="px-8 py-4">Categoría</th>
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
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg">{item.stock}</span>
                      <span className="text-xs font-bold text-zinc-400">{item.unit}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-bold text-zinc-700">{currency.format(item.cost_cents ? item.cost_cents / 100 : 0)}</td>
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
                    <button className="p-2 text-zinc-400 hover:text-zinc-950 transition-colors">
                      <Settings size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 p-8 rounded-[32px] bg-zinc-900 text-white flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-[24px] bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Printer size={40} />
            </div>
            <div>
              <h4 className="text-xl font-black">Fargo DTC1500</h4>
              <p className="text-zinc-400 font-medium">Estado: Operativa | Cabezal: 98% vida útil</p>
              <div className="mt-2 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[98%]"></div>
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
      </div>
    </div>
  );
};

export default InventoryDashboard;
