import React from 'react';
import { CreditCard, Archive, ShieldBan, Link as LinkIcon } from 'lucide-react';

const AdminCardsDashboard = ({ cards = [] }) => {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Cards Control Center</h1>
            <p className="text-zinc-500 font-medium">Visibilidad mínima del lifecycle NFC: estado, activación, archivado y asociación</p>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden" data-cy="admin-cards-table">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                <th className="px-8 py-4">Card</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Activation</th>
                <th className="px-8 py-4">Profile</th>
                <th className="px-8 py-4">Deleted</th>
                <th className="px-8 py-4 text-right">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 rounded-xl text-zinc-400">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <p className="font-black text-sm">{card.card_code}</p>
                        <p className="text-xs text-zinc-400 font-medium">{card.public_token || 'sin token'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-bold uppercase text-xs">{card.status || '-'}</td>
                  <td className="px-8 py-5 font-bold uppercase text-xs text-zinc-500">{card.activation_status || '-'}</td>
                  <td className="px-8 py-5 text-sm font-medium text-zinc-700">{card.profile_slug || card.profile_id || '-'}</td>
                  <td className="px-8 py-5 text-sm font-medium text-zinc-700">{card.deleted_at ? 'Sí' : 'No'}</td>
                  <td className="px-8 py-5">
                    <div className="flex justify-end gap-2 text-zinc-500">
                      {card.status === 'revoked' && <ShieldBan size={16} title="Revocada" />}
                      {card.status === 'archived' && <Archive size={16} title="Archivada" />}
                      {card.public_token && <LinkIcon size={16} title="Token activo" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCardsDashboard;
