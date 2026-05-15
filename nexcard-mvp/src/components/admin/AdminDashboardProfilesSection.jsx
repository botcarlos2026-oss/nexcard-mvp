import React from 'react';
import { Eye, MousePointer2, QrCode, TrendingUp } from 'lucide-react';
import { generateQRCode } from '../../utils/qrEngine';
import AdminCard from '../ui/AdminCard';
import { TH, TD } from '../ui/AdminTable';
import AdminBadge from '../ui/AdminBadge';

export default function AdminDashboardProfilesSection({ searchTerm, onSearchTermChange, filteredUsers, recentOrders }) {
  return (
    <div className="grid lg:grid-cols-[1.6fr,1fr] gap-6">
      <AdminCard className="!p-0 overflow-hidden" data-cy="admin-inventory">
        <div className="p-5 border-b border-zinc-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-lg text-white">Perfiles y rendimiento</h2>
            <p className="text-sm text-zinc-400 font-medium">Base preparada para personas, pymes y cuentas empresa</p>
          </div>
          <input
            type="text"
            placeholder="Filtrar por nombre..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full md:w-72 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
          />
        </div>
        <div className="overflow-x-auto" data-cy="admin-users-table">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/50 border-b border-zinc-800">
              <tr className="text-xs uppercase tracking-wide text-zinc-500">
                <TH>Usuario</TH>
                <TH className="text-center">Taps</TH>
                <TH className="text-center">WhatsApp</TH>
                <TH className="text-center">vCard</TH>
                <TH className="text-center">Tipo</TH>
                <TH className="text-right">Acciones</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors group">
                  <TD>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full shadow-inner shrink-0" style={{ backgroundColor: user.color }}></div>
                      <div>
                        <span className="font-bold text-sm text-white block">{user.name}</span>
                        <AdminBadge variant={user.status === 'active' ? 'success' : 'default'}>{user.status}</AdminBadge>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-center font-bold text-white">{user.taps}</TD>
                  <TD className="text-center text-zinc-300">{user.wa_clicks}</TD>
                  <TD className="text-center text-zinc-300">{user.vcard_clicks}</TD>
                  <TD className="text-center">
                    <AdminBadge>{user.account_type}</AdminBadge>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`/${user.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 hover:bg-zinc-700 rounded-lg transition-all text-zinc-400 hover:text-emerald-400"
                        title="Ver Perfil"
                      >
                        <Eye size={18} />
                      </a>
                      <button
                        onClick={() => generateQRCode(user.slug, { color: user.color })}
                        className="p-2 hover:bg-zinc-700 rounded-lg transition-all text-zinc-400 hover:text-blue-400"
                        title="Descargar QR"
                      >
                        <QrCode size={18} />
                      </button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <div className="space-y-6">
        <AdminCard>
          <h3 className="font-bold text-lg text-white mb-4">Últimos pedidos reales</h3>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-400 font-medium">
                Sin pedidos reales todavía. El panel está mostrando solo operación no-QA.
              </div>
            ) : recentOrders.map((order) => (
              <div key={order.id} className="p-4 rounded-xl bg-zinc-800 border border-zinc-700">
                <div className="flex justify-between gap-4 items-start">
                  <div>
                    <p className="font-bold text-sm text-white">{order.customer_name}</p>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5">{order.payment_method} · {order.payment_status}</p>
                  </div>
                  <span className="text-sm font-bold text-white shrink-0">{order.amount_cents ? Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(order.amount_cents || 0) : '-'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{order.id}</span>
                  <AdminBadge variant={order.fulfillment_status === 'delivered' ? 'success' : order.fulfillment_status === 'shipped' ? 'info' : order.fulfillment_status === 'in_production' ? 'info' : order.fulfillment_status === 'cancelled' ? 'danger' : 'warning'}>
                    {order.fulfillment_status}
                  </AdminBadge>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard className="bg-zinc-900">
          <p className="text-xs uppercase tracking-widest font-bold text-zinc-500 mb-3">Diagnóstico</p>
          <p className="text-sm font-medium leading-relaxed text-zinc-300">
            Base lista para migrar admin e integraciones de pago. Siguiente cuello de botella: auth/roles efectivos, CMS admin y órdenes conectadas a producción.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm font-bold">
            <div className="bg-white/5 rounded-xl p-4">
              <MousePointer2 className="mb-2 text-emerald-400" size={18} />
              <span className="text-zinc-300">Más control del funnel</span>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <TrendingUp className="mb-2 text-blue-400" size={18} />
              <span className="text-zinc-300">Escala sin rehacer panel</span>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
