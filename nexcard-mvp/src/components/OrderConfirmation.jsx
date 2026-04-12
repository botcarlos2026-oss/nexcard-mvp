import React from 'react';
import { CheckCircle, Copy } from 'lucide-react';

export default function OrderConfirmation({ order, onContinueShopping }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const orderDate = new Date(order.created_at).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalCLP = (order.amount_cents / 100).toLocaleString('es-CL');

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Icono de éxito */}
        <div className="text-center mb-8">
          <CheckCircle size={80} className="mx-auto text-emerald-400 mb-4" />
          <h1 className="text-4xl font-black mb-2">¡Orden Confirmada!</h1>
          <p className="text-zinc-400 text-lg">Tu compra ha sido procesada correctamente</p>
        </div>

        {/* Detalles de la orden */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-zinc-800">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Número de Orden</p>
              <div className="flex items-center gap-2">
                <code className="bg-zinc-800 px-3 py-2 rounded font-mono text-sm break-all">
                  {order.id.substring(0, 8)}...{order.id.substring(order.id.length - 8)}
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

            <div>
              <p className="text-zinc-400 text-sm mb-1">Email</p>
              <p className="font-semibold">{order.customer_email}</p>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-1">Método de Pago</p>
              <p className="font-semibold capitalize">
                {order.payment_method === 'mercado-pago' ? 'Mercado Pago' : 'Transbank WebPay'}
              </p>
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-4">
            <div>
              <p className="text-zinc-400 text-sm mb-2">Estado de Pago</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="font-semibold capitalize">{order.payment_status}</span>
                <span className="text-zinc-500 text-sm">(Pendiente de confirmación)</span>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-2">Estado de Entrega</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <span className="font-semibold capitalize">{order.fulfillment_status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monto */}
        <div className="bg-emerald-900 border border-emerald-700 rounded-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-xl font-semibold">Total Pagado</span>
            <span className="text-3xl font-black text-emerald-400">${totalCLP}</span>
          </div>
        </div>

        {/* Información */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-8">
          <h2 className="font-bold text-lg mb-4">¿Qué sucede ahora?</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-bold text-emerald-400 min-w-6">1</span>
              <span>Recibirás un email de confirmación en <strong>{order.customer_email}</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-emerald-400 min-w-6">2</span>
              <span>Nuestro equipo procesará tu pago a través de {order.payment_method === 'mercado-pago' ? 'Mercado Pago' : 'Transbank'}</span>
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
        </div>

        {/* CTA */}
        <button
          onClick={onContinueShopping}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-lg transition-colors text-lg"
        >
          Volver al Catálogo
        </button>

        {/* Footer */}
        <div className="text-center mt-8 text-zinc-500 text-sm">
          <p>¿Preguntas? Contacta a <strong>soporte@nexcard.com</strong></p>
        </div>
      </div>
    </div>
  );
}
