import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import CardPreview from '../CardPreview';
import { generateCardSVG } from '../../utils/cardTemplates';
import AdminBadge from '../ui/AdminBadge';
import { currency, formatActorLabel, formatLabel } from './utils';

const TEMPLATE_LABELS = {
  minimal: 'Minimalista',
  dark: 'Dark premium',
  corporate: 'Corporativo',
  colorful: 'Colorido',
};

export default function OrdersDetailSupportPanels({
  order,
  orderHistory,
  draftOrder,
  setDraftOrder,
  busyOrderId,
  saveDraftOrder,
  refundByOrder,
  refundForm,
  onRefundFormChange,
  refundBusy,
  onProcessRefund,
  OrderRefundCard,
}) {
  if (!order) return null;

  return (
    <>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Ítems</p>
        <div className="space-y-3">
          {order.items.length > 0 ? order.items.map((item, index) => (
            <div key={`${order.id}-${index}`} className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-white">{item.product_name || item.product_id || 'Producto'}</p>
                  <p className="text-xs text-zinc-500 font-medium">SKU: {item.sku || '—'}</p>
                </div>
                <div className="text-right text-sm font-bold text-zinc-300">
                  <p>x{item.quantity || 0}</p>
                  <p>{currency((item.unit_price_cents || 0) * (item.quantity || 0))}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-zinc-700 p-4 text-sm font-medium text-zinc-500">
              La orden no trae items asociados en esta consulta.
            </div>
          )}
        </div>
      </div>

      {order.related_cards?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Cards relacionadas</p>
          <div className="space-y-3">
            {order.related_cards.map((card) => (
              <div key={card.id} className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-white">{card.card_code}</p>
                  <p className="text-xs text-zinc-500 font-medium">{card.profile_id || 'Sin perfil'}</p>
                </div>
                <div className="text-right flex flex-col gap-1">
                  <AdminBadge variant={card.status === 'active' ? 'success' : card.status === 'revoked' ? 'danger' : 'default'}>{formatLabel(card.status)}</AdminBadge>
                  <AdminBadge variant={card.activation_status === 'activated' ? 'success' : card.activation_status === 'unassigned' ? 'warning' : 'default'}>{formatLabel(card.activation_status)}</AdminBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {orderHistory?.length > 0 && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Historial de cambios</p>
          <div className="space-y-2">
            {orderHistory.map((entry, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-2 border-b border-zinc-700 last:border-0">
                <div>
                  <p className="text-xs font-bold text-zinc-300 capitalize">{entry.field.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-zinc-500">
                    <span className="line-through">{entry.old_value || '—'}</span>
                    {' → '}
                    <span className="text-emerald-400 font-bold">{entry.new_value}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-zinc-500">
                    {new Date(entry.changed_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {formatActorLabel(entry)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-4">
        <div>
          <p className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Contacto</p>
          <div className="grid gap-3">
            <input
              type="text"
              value={draftOrder?.customer_phone || ''}
              onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), customer_phone: event.target.value }))}
              disabled={busyOrderId === order.id}
              placeholder="Teléfono cliente"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
            <input
              type="text"
              value={draftOrder?.customer_email || ''}
              onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), customer_email: event.target.value }))}
              disabled={busyOrderId === order.id}
              placeholder="Email cliente"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Dirección / retiro</label>
          <textarea
            value={draftOrder?.customer_address || ''}
            onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), customer_address: event.target.value }))}
            disabled={busyOrderId === order.id}
            rows="3"
            placeholder="Dirección de despacho o instrucción de retiro"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Notas</label>
          <textarea
            value={draftOrder?.notes || ''}
            onChange={(event) => setDraftOrder((prev) => ({ ...(prev || {}), notes: event.target.value }))}
            disabled={busyOrderId === order.id}
            rows="4"
            placeholder="Observaciones operativas internas"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setDraftOrder({
            customer_phone: order.customer_phone || '',
            customer_email: order.customer_email || '',
            customer_address: order.customer_address || order.delivery_address || '',
            notes: order.notes || '',
          })}
          disabled={busyOrderId === order.id}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          Descartar cambios
        </button>
        <button
          type="button"
          onClick={saveDraftOrder}
          disabled={busyOrderId === order.id}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {busyOrderId === order.id ? <Loader2 size={16} className="animate-spin" /> : null}
          Guardar datos operativos
        </button>
      </div>

      {order.card_customization && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Personalización solicitada</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {order.card_customization.full_name && (
              <div>
                <p className="text-xs text-zinc-500 font-semibold mb-0.5">Nombre</p>
                <p className="text-white font-medium">{order.card_customization.full_name}</p>
              </div>
            )}
            {order.card_customization.job_title && (
              <div>
                <p className="text-xs text-zinc-500 font-semibold mb-0.5">Cargo</p>
                <p className="text-white font-medium">{order.card_customization.job_title}</p>
              </div>
            )}
            {order.card_customization.company && (
              <div>
                <p className="text-xs text-zinc-500 font-semibold mb-0.5">Empresa</p>
                <p className="text-white font-medium">{order.card_customization.company}</p>
              </div>
            )}
            {order.card_customization.template && (
              <div>
                <p className="text-xs text-zinc-500 font-semibold mb-0.5">Plantilla</p>
                <p className="text-white font-medium capitalize">{TEMPLATE_LABELS[order.card_customization.template] || order.card_customization.template}</p>
              </div>
            )}
            {order.card_customization.primary_color && (
              <div>
                <p className="text-xs text-zinc-500 font-semibold mb-0.5">Color principal</p>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border border-zinc-600" style={{ backgroundColor: order.card_customization.primary_color }} />
                  <span className="text-white font-mono text-xs">{order.card_customization.primary_color}</span>
                </div>
              </div>
            )}
          </div>
          {order.card_customization.notes && (
            <div>
              <p className="text-xs text-zinc-500 font-semibold mb-0.5">Notas</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{order.card_customization.notes}</p>
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Vista previa de la tarjeta</p>
            <CardPreview
              template={order.card_customization.template || 'minimal'}
              name={order.card_customization.full_name || order.customer_name || 'Tu Nombre'}
              jobTitle={order.card_customization.job_title || 'Tu Cargo'}
              company={order.card_customization.company || ''}
              primaryColor={order.card_customization.primary_color || '#10B981'}
              size="full"
            />
            <button
              type="button"
              className="mt-3 w-full text-sm font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg py-2 px-4 transition-colors"
              onClick={() => {
                const svg = generateCardSVG(order.card_customization.template || 'minimal', {
                  name: order.card_customization.full_name || order.customer_name || 'Tu Nombre',
                  jobTitle: order.card_customization.job_title || 'Tu Cargo',
                  company: order.card_customization.company || '',
                  primaryColor: order.card_customization.primary_color || '#10B981',
                });
                const win = window.open('', '_blank');
                win.document.write(`<!DOCTYPE html><html><head><style>@page{size:85.6mm 54mm;margin:0;bleed:1mm;}body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;width:85.6mm;height:54mm;overflow:hidden;}.card{width:85.6mm;height:54mm;position:relative;}.safe-area{position:absolute;top:3mm;left:3mm;right:3mm;bottom:3mm;border:1px dashed rgba(255,0,0,0.3);pointer-events:none;}@media print{.safe-area{display:none;}}svg{width:85.6mm;height:54mm;}</style></head><body><div class="card"><div class="safe-area"></div>${svg}</div></body></html>`);
                win.document.close();
                win.focus();
                win.print();
              }}
            >
              Imprimir diseño
            </button>
          </div>
        </div>
      )}

      <OrderRefundCard
        order={order}
        refundByOrder={refundByOrder}
        refundForm={refundForm}
        onRefundFormChange={onRefundFormChange}
        refundBusy={refundBusy}
        onProcessRefund={onProcessRefund}
      />

      <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-4 text-sm font-semibold text-amber-400 flex items-start gap-3">
        {busyOrderId === order.id ? <Loader2 size={18} className="mt-0.5 animate-spin" /> : <AlertCircle size={18} className="mt-0.5" />}
        <span>Este MVP ya permite cambio manual de estados. La siguiente iteración debería sumar acciones masivas, SLA visible y reservas transaccionales nativas en DB.</span>
      </div>
    </>
  );
}
