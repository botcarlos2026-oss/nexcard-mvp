import React, { useEffect, useState } from 'react';
import { CreditCard, Archive, ShieldBan, Link as LinkIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const badgeClasses = {
  printed: 'bg-zinc-100 text-zinc-700',
  assigned: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  revoked: 'bg-rose-100 text-rose-700',
  archived: 'bg-zinc-200 text-zinc-700',
};

const activationBadgeClasses = {
  pending: 'bg-zinc-100 text-zinc-700',
  unassigned: 'bg-zinc-100 text-zinc-700',
  assigned: 'bg-sky-100 text-sky-700',
  activated: 'bg-emerald-100 text-emerald-700',
  active: 'bg-emerald-100 text-emerald-700',
  revoked: 'bg-rose-100 text-rose-700',
};

const formatLabel = (value) => (value ? String(value).replace(/_/g, ' ') : '-');

const AdminCardsDashboard = ({ cards = [] }) => {
  const [rows, setRows] = useState(cards);
  const [busyCardId, setBusyCardId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    setRows(cards);
  }, [cards]);

  const canRevoke = (card) => !card.deleted_at && card.status !== 'revoked' && card.status !== 'archived';
  const canArchive = (card) => !card.deleted_at && card.status !== 'archived';

  const runCardAction = async (card, action) => {
    setBusyCardId(card.id);
    setFeedback({ type: '', message: '' });

    try {
      const response = action === 'revoke'
        ? await api.revokeCard(card.id)
        : await api.archiveCard(card.id);

      setRows(response.cards || []);
      setFeedback({
        type: 'success',
        message: action === 'revoke'
          ? `Tarjeta ${card.card_code} revocada.`
          : `Tarjeta ${card.card_code} archivada.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message || 'No fue posible ejecutar la acción sobre la tarjeta.',
      });
    } finally {
      setBusyCardId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Cards Control Center</h1>
            <p className="text-zinc-500 font-medium">Lifecycle mínimo NFC: visibilidad, revoke y archive con contrato claro hacia Supabase RPC.</p>
          </div>
        </div>

        {feedback.message && (
          <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm overflow-hidden" data-cy="admin-cards-table">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 text-zinc-400 text-[10px] uppercase tracking-widest font-black">
                <th className="px-8 py-4">Card</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Activation</th>
                <th className="px-8 py-4">Profile</th>
                <th className="px-8 py-4">Deleted</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {rows.map((card) => {
                const isBusy = busyCardId === card.id;
                const revokeDisabled = isBusy || !canRevoke(card);
                const archiveDisabled = isBusy || !canArchive(card);

                return (
                  <tr key={card.id} className="hover:bg-zinc-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 rounded-xl text-zinc-400">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <p className="font-black text-sm">{card.card_code}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                            <span>{card.public_token || 'sin token'}</span>
                            {card.public_token && <LinkIcon size={14} title="Token activo" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${badgeClasses[card.status] || 'bg-zinc-100 text-zinc-700'}`}>
                        {formatLabel(card.status)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${activationBadgeClasses[card.activation_status] || 'bg-zinc-100 text-zinc-700'}`}>
                        {formatLabel(card.activation_status)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-zinc-700">{card.profile_slug || card.profile_id || '-'}</td>
                    <td className="px-8 py-5 text-sm font-medium text-zinc-700">{card.deleted_at ? 'Sí' : 'No'}</td>
                    <td className="px-8 py-5">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          type="button"
                          onClick={() => runCardAction(card, 'revoke')}
                          disabled={revokeDisabled}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent"
                          title={revokeDisabled ? 'Solo se puede revocar una tarjeta activa/no archivada.' : 'Revocar tarjeta'}
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldBan size={14} />}
                          Revoke
                        </button>
                        <button
                          type="button"
                          onClick={() => runCardAction(card, 'archive')}
                          disabled={archiveDisabled}
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:hover:bg-transparent"
                          title={archiveDisabled ? 'Solo se puede archivar una tarjeta no archivada.' : 'Archivar tarjeta'}
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCardsDashboard;
