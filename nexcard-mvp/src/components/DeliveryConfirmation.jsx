import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const DeliveryConfirmation = ({ orderId, token }) => {
  const [status, setStatus] = useState('loading'); // loading | success | already_confirmed | invalid | error
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!orderId || !token) {
      setStatus('invalid');
      return;
    }

    const confirm = async () => {
      try {
        // Verify order + token match
        const { data: orderData, error } = await supabase
          .from('orders')
          .select('id, customer_name, fulfillment_status, delivered_at, delivery_confirmed_by, delivery_token')
          .eq('id', orderId)
          .eq('delivery_token', token)
          .single();

        if (error || !orderData) {
          setStatus('invalid');
          return;
        }

        setOrder(orderData);

        // Already confirmed
        if (orderData.delivered_at || orderData.delivery_confirmed_by) {
          setStatus('already_confirmed');
          return;
        }

        // Confirm delivery
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            fulfillment_status: 'delivered',
            delivered_at: new Date().toISOString(),
            delivery_confirmed_by: 'customer',
          })
          .eq('id', orderId)
          .eq('delivery_token', token);

        if (updateError) throw new Error(updateError.message);

        setStatus('success');
      } catch (err) {
        setStatus('error');
      }
    };

    confirm();
  }, [orderId, token]);

  const shortId = orderId ? String(orderId).slice(0, 8).toUpperCase() : '—';

  return (
    <div className="min-h-screen bg-zinc-950 grid place-items-center p-8 font-sans">
      <div className="max-w-sm w-full">

        {/* NexCard logo */}
        <div className="text-center mb-8">
          <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">NexCard</p>
        </div>

        <div className="bg-white rounded-[32px] p-8 text-center shadow-xl">

          {status === 'loading' && (
            <>
              <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto mb-4" />
              <h1 className="text-xl font-black text-zinc-950 mb-2">Confirmando entrega…</h1>
              <p className="text-sm font-medium text-zinc-500">Un momento por favor.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h1 className="text-2xl font-black text-zinc-950 mb-2">¡Entrega confirmada!</h1>
              <p className="text-sm font-medium text-zinc-500 leading-relaxed mb-6">
                Gracias {order?.customer_name ? `, ${order.customer_name}` : ''}. Registramos que recibiste tu tarjeta NexCard del pedido <strong>#{shortId}</strong>.
              </p>
              <div className="bg-zinc-950 rounded-2xl p-5 text-white text-left">
                <div className="flex items-center gap-3 mb-3">
                  <Package size={18} className="text-emerald-400" />
                  <p className="font-black text-sm">Tu tarjeta NexCard está lista</p>
                </div>
                <p className="text-xs font-medium text-zinc-400 leading-relaxed">
                  Acerca tu tarjeta NFC a cualquier teléfono para activar tu perfil digital.
                  Si es tu primera vez, toca la notificación que aparece en tu pantalla.
                </p>
              </div>
              <a
                href="/"
                className="mt-4 inline-block w-full py-3 bg-emerald-500 text-white font-black rounded-2xl text-sm"
              >
                Ir a nexcard.cl
              </a>
            </>
          )}

          {status === 'already_confirmed' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-sky-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={32} className="text-sky-500" />
              </div>
              <h1 className="text-xl font-black text-zinc-950 mb-2">Ya confirmado</h1>
              <p className="text-sm font-medium text-zinc-500 leading-relaxed">
                La entrega del pedido <strong>#{shortId}</strong> ya fue confirmada anteriormente. ¡Disfruta tu NexCard!
              </p>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={32} className="text-rose-500" />
              </div>
              <h1 className="text-xl font-black text-zinc-950 mb-2">Enlace inválido</h1>
              <p className="text-sm font-medium text-zinc-500 leading-relaxed">
                El enlace de confirmación no es válido o ya expiró. Si crees que esto es un error,
                escríbenos a <a href="mailto:hola@nexcard.cl" className="text-emerald-600 font-bold">hola@nexcard.cl</a>.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={32} className="text-rose-500" />
              </div>
              <h1 className="text-xl font-black text-zinc-950 mb-2">Error al confirmar</h1>
              <p className="text-sm font-medium text-zinc-500 leading-relaxed mb-4">
                No pudimos procesar tu confirmación. Intenta nuevamente o contáctanos.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-zinc-950 text-white font-black rounded-2xl text-sm"
              >
                Reintentar
              </button>
            </>
          )}

        </div>

        <p className="text-center text-zinc-600 text-xs font-medium mt-6">nexcard.cl · hola@nexcard.cl</p>
      </div>
    </div>
  );
};

export default DeliveryConfirmation;
