import React from 'react';
import { CheckCircle2, Link2, Loader2, QrCode, Wifi } from 'lucide-react';
import AdminBadge from '../ui/AdminBadge';
import { formatDate } from './utils';

export default function OrderNfcCard({
  order,
  linkingCardId,
  onLinkingCardIdChange,
  onLinkCardToOrder,
  busyOrderId,
  nfcSlug,
  onNfcSlugChange,
  nfcSlugLoading,
  nfcBusy,
  onConfirmNfcProgramming,
  nfcQrDataUrl,
}) {
  const linkedCard = order.related_cards?.find((card) => card.order_id === order.id) || order.related_cards?.[0];
  const alreadyProgrammed = linkedCard?.nfc_url;
  const programmedUrl = linkedCard?.nfc_url || `https://nexcard.cl/${nfcSlug}`;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Programación NFC</p>

      <div className="space-y-2">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Paso A — Vincular card física</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={linkingCardId}
            onChange={(event) => onLinkingCardIdChange(event.target.value)}
            disabled={busyOrderId === order.id}
            placeholder="UUID de card"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors sm:w-72"
          />
          <button
            type="button"
            onClick={onLinkCardToOrder}
            disabled={busyOrderId === order.id || !linkingCardId}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <Link2 size={16} />
            Vincular
          </button>
        </div>
        {order.related_cards?.length > 0 && (
          <p className="text-xs text-emerald-400 font-bold">
            Card vinculada: {order.related_cards[0].card_code || order.related_cards[0].id}
          </p>
        )}
      </div>

      {order.related_cards?.length > 0 && !alreadyProgrammed && (
        <div className="space-y-3 border-t border-zinc-700 pt-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Paso B — Configurar URL del NFC</p>
          <p className="text-xs text-zinc-500">
            URL que se programará en el chip:{' '}
            <span className="font-bold text-zinc-300">https://nexcard.cl/{nfcSlug || '<slug>'}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-bold text-zinc-500 shrink-0">nexcard.cl/</span>
              <input
                type="text"
                value={nfcSlug}
                onChange={(event) => onNfcSlugChange(event.target.value)}
                placeholder={nfcSlugLoading ? 'Buscando slug...' : 'slug-del-cliente'}
                disabled={nfcBusy || nfcSlugLoading}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={onConfirmNfcProgramming}
              disabled={nfcBusy || !nfcSlug}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {nfcBusy ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
              Confirmar NFC
            </button>
          </div>
        </div>
      )}

      {order.related_cards?.length > 0 && (alreadyProgrammed || nfcQrDataUrl) && (
        <div className="space-y-3 border-t border-zinc-700 pt-4">
          <div className="flex items-center gap-2">
            <AdminBadge variant="success">
              <CheckCircle2 size={12} className="mr-1" />
              NFC PROGRAMADO
            </AdminBadge>
          </div>
          <p className="text-xs text-zinc-500">
            URL: <a href={programmedUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-400 underline">{programmedUrl}</a>
          </p>
          {linkedCard?.programmed_at && (
            <p className="text-xs text-zinc-500">Programado: {formatDate(linkedCard.programmed_at)}</p>
          )}
          {nfcQrDataUrl && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
                <QrCode size={12} />
                QR de verificación
              </p>
              <img src={nfcQrDataUrl} alt="QR NFC" className="w-32 h-32 rounded-xl border border-zinc-700" />
              <p className="text-[11px] text-zinc-500">Escanea con tu teléfono para verificar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
