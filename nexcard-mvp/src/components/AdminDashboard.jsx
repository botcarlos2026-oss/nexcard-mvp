import React, { useMemo, useState } from 'react';
import {
  Users,
  TrendingUp,
  Eye,
  MousePointer2,
  QrCode,
  Package,
  DollarSign
} from 'lucide-react';
import { generateQRCode } from '../utils/qrEngine';

const AdminDashboard = ({ dashboard }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const users = dashboard?.users || [];
  const statsSource = dashboard?.stats || {};
  const recentOrders = dashboard?.recentOrders || [];

  const stats = useMemo(() => ([
    { label: 'Ingresos cobrados', value: statsSource.totalRevenue || 0, icon: DollarSign, color: 'text-emerald-500' },
    { label: 'Perfiles activos', value: `${statsSource.totalProfiles || 0}`, icon: Users, color: 'text-blue-500' },
    { label: 'Pedidos abiertos', value: `${statsSource.pendingOrders || 0}`, icon: Package, color: 'text-amber-500' },
  ]), [statsSource]);

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-950">NexCard Control Center</h1>
          <p className="text-zinc-500 font-medium">Conversión, perfiles, pedidos y salud operativa desde un solo panel</p>
        </div>
        <div className="flex gap-3">
          <a href="/admin/cards" className="px-4 py-3 bg-zinc-950 text-white rounded-2xl font-bold text-sm">Ver Cards</a>
          <a href="/admin/profiles" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Profiles</a>
          <a href="/admin/inventory" className="px-4 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold text-sm">Inventario</a>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-zinc-50 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.6fr,1fr] gap-6">
        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden" data-cy="admin-inventory">
          <div className="p-6 border-b border-zinc-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black text-xl">Perfiles y rendimiento</h2>
              <p className="text-sm text-zinc-500 font-medium">Base preparada para personas, pymes y cuentas empresa</p>
            </div>
            <input
              type="text"
              placeholder="Filtrar por nombre..."
              className="w-full md:w-80 px-5 py-3 bg-zinc-50 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto" data-cy="admin-users-table">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                  <th className="px-8 py-4">Usuario</th>
                  <th className="px-8 py-4 text-center">Taps</th>
                  <th className="px-8 py-4 text-center">WhatsApp</th>
                  <th className="px-8 py-4 text-center">vCard</th>
                  <th className="px-8 py-4 text-center">Tipo</th>
                  <th className="px-8 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50/30 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full shadow-inner" style={{ backgroundColor: user.color }}></div>
                        <div>
                          <span className="font-bold text-sm block">{user.name}</span>
                          <span className="text-xs text-zinc-400 font-bold uppercase">{user.status}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center font-black">{user.taps}</td>
                    <td className="px-8 py-5 text-center font-bold text-zinc-600">{user.wa_clicks}</td>
                    <td className="px-8 py-5 text-center font-bold text-zinc-600">{user.vcard_clicks}</td>
                    <td className="px-8 py-5 text-center">
                      <span className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-black uppercase">{user.account_type}</span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`/${user.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-400 hover:text-emerald-500"
                          title="Ver Perfil"
                        >
                          <Eye size={18} />
                        </a>
                        <button
                          onClick={() => generateQRCode(user.slug, { color: user.color })}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-400 hover:text-blue-500"
                          title="Descargar QR"
                        >
                          <QrCode size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm p-6">
            <h3 className="font-black text-lg mb-4">Últimos pedidos</h3>
            <div className="space-y-4">
              {recentOrders.map(order => (
                <div key={order.id} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <div className="flex justify-between gap-4 items-start">
                    <div>
                      <p className="font-black text-sm">{order.customer_name}</p>
                      <p className="text-xs text-zinc-500 font-medium">{order.payment_method} · {order.payment_status}</p>
                    </div>
                    <span className="text-sm font-black text-zinc-950">{order.amount_cents ? Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(order.amount_cents / 100) : '-'}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-400">
                    <span>{order.id}</span>
                    <span>{order.fulfillment_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-950 text-white rounded-[32px] p-6 shadow-sm">
            <p className="text-xs uppercase tracking-widest font-black text-zinc-500 mb-3">Diagnóstico</p>
            <p className="text-sm font-medium leading-relaxed text-zinc-300">
              Base lista para migrar admin e integraciones de pago. Siguiente cuello de botella: auth/roles efectivos, CMS admin y órdenes conectadas a producción.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm font-bold">
              <div className="bg-white/5 rounded-2xl p-4">
                <MousePointer2 className="mb-2 text-emerald-400" size={18} />
                Más control del funnel
              </div>
              <div className="bg-white/5 rounded-2xl p-4">
                <TrendingUp className="mb-2 text-blue-400" size={18} />
                Escala sin rehacer panel
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
