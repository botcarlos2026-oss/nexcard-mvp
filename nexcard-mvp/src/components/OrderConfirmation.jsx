import React from 'react';
import { CheckCircle, Clock, Copy } from 'lucide-react';

export default function OrderConfirmation({ order }) {
  const [copied, setCopied] = React.useState(false);
  const customerEmail = typeof order.customer_email === 'string' ? order.customer_email.trim() : '';
  const hasExplicitAmount = typeof order.amount_cents === 'number'
    ? Number.isFinite(order.amount_cents)
    : typeof order.amount_cents === 'string'
      && order.amount_cents.trim() !== ''
      && Number.isFinite(Number(order.amount_cents));
  const hasReceiptDetails = !order.guestReceiptUnavailable && Boolean(customerEmail && hasExplicitAmount);
  const hasPaymentMethod = hasReceiptDetails && Boolean(order.payment_method);
  const hasFulfillmentStatus = hasReceiptDetails && Boolean(order.fulfillment_status);

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const paymentStatusLabel = {
    paid: { text: 'Pago confirmado', color: 'text-emerald-400' },
    verifying: { text: 'Confirmando pago', color: 'text-amber-400' },
    success: { text: 'Confirmando pago', color: 'text-amber-400' },
    pending: { text: 'Pendiente de confirmación', color: 'text-amber-400' },
    failed: { text: 'Pago rechazado', color: 'text-red-400' },
  }[order.payment_status] || { text: 'Pendiente', color: 'text-amber-400' };
  const isPaid = order.payment_status === 'paid';
  const isFailed = order.payment_status === 'failed';

  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'En verificación';

  const totalCLP = hasReceiptDetails ? Number(order.amount_cents).toLocaleString('es-CL') : null;

  const fulfillmentStatusLabel = {
    new: 'Nueva',
    in_production: 'En producción',
    ready: 'Lista para despacho',
    shipped: 'Enviada',
    delivered: 'Entregada',
    cancelled: 'Cancelada',
  }[order.fulfillment_status] || order.fulfillment_status;

  const paymentMethodLabel = {
    'mercado-pago': 'Mercado Pago',
    mercado_pago: 'Mercado Pago',
    webpay: 'Transbank WebPay',
    transbank: 'Transbank WebPay',
  }[order.payment_method] || order.payment_method;

  const displayOrderReference = order.folio || `#${order.id.substring(0, 8).toUpperCase()}`;
  const whatsappMessage = `Hola, mi folio es ${displayOrderReference}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          {isPaid ? (
            <>
              <CheckCircle size={80} className="mx-auto text-emerald-400 mb-4" />
              <h1 className="text-4xl font-black mb-2">¡Orden Confirmada!</h1>
              <p className="text-zinc-400 text-lg">Tu compra ha sido procesada correctamente</p>
            </>
          ) : (
            <>
              <Clock size={80} className="mx-auto text-amber-400 mb-4" />
              <h1 className="text-4xl font-black mb-2">Orden Recibida</h1>
              <p className="text-zinc-400 text-lg">Tu orden fue recibida. El pago está siendo verificado.</p>
            </>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-zinc-800">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Número de Orden</p>
              <div className="flex items-center gap-2">
                <code className="bg-zinc-800 px-3 py-2 rounded font-mono text-sm break-all">
                  {displayOrderReference}
                </code>
                <button
                  onClick={handleCopyOrderId}
                  className="p-2 hover:bg-zinc-800 rounded transition-colors"
                  title="Copiar ID"
                >
                  <Copy size={18} />
                </button>
              </div>
              {copied && <p className="text-emerald-400 text-xs mt-1">¡Copiado!</p>}
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-1">Fecha</p>
              <p className="font-semibold">{orderDate}</p>
            </div>

            {hasReceiptDetails && (
              <div>
                <p className="text-zinc-400 text-sm mb-1">Email</p>
                <p className="font-semibold">{customerEmail}</p>
              </div>
            )}

            {hasPaymentMethod && (
              <div>
                <p className="text-zinc-400 text-sm mb-1">Método de Pago</p>
                <p className="font-semibold capitalize">{paymentMethodLabel}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-zinc-400 text-sm mb-2">Estado de Pago</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  isPaid ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="font-semibold">{paymentStatusLabel.text}</span>
              </div>
              {order.payment_verification_message && (
                <p className="mt-3 text-sm text-zinc-400">{order.payment_verification_message}</p>
              )}
            </div>

            {hasFulfillmentStatus && (
              <div>
                <p className="text-zinc-400 text-sm mb-2">Estado de Entrega</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                  <span className="font-semibold">{fulfillmentStatusLabel}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {hasReceiptDetails && (
          <div className="bg-emerald-900 border border-emerald-700 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center">
              <span className="text-xl font-semibold">{isPaid ? 'Total Pagado' : 'Total de la orden'}</span>
              <span className="text-3xl font-black text-emerald-400">${totalCLP}</span>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="font-bold text-lg mb-4">¿Qué sucede ahora?</h2>
          {hasReceiptDetails ? (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="font-bold text-emerald-400 min-w-6">1</span>
                <span>Recibirás un email de confirmación en <strong>{customerEmail}</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-emerald-400 min-w-6">2</span>
                <span>
                  {hasPaymentMethod
                    ? `Nuestro equipo procesará tu pago a través de ${paymentMethodLabel}`
                    : 'Nuestro equipo procesará tu pago.'}
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-emerald-400 min-w-6">3</span>
                <span>Una vez confirmado el pago, procederemos con el empaque y envío</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-emerald-400 min-w-6">4</span>
                <span>Recibirás un seguimiento con tu número de guía de despacho</span>
              </li>
            </ol>
          ) : (
            <p className="text-sm text-zinc-300">Guarda tu número de orden. Si necesitas ayuda, contáctanos por WhatsApp e indícanos este identificador.</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <a
            href={`https://wa.me/56993183021?text=${encodeURIComponent(whatsappMessage)}`}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold transition-colors"
          >
            💬 Seguimiento por WhatsApp
          </a>
          <a href="/"
            className="flex items-center justify-center px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors"
          >
            Volver al inicio
          </a>
        </div>
        {hasReceiptDetails && (
          <p className="text-zinc-400 text-xs mt-4 text-center">
            Recibirás un email con actualizaciones. Tu tarjeta estará lista en 5-7 días hábiles.
          </p>
        )}

        <div className="text-center mt-8 text-zinc-500 text-sm">
          <p>¿Preguntas? Contacta a <strong>hola@nexcard.cl</strong></p>
        </div>
      </div>
    </div>
  );
}
