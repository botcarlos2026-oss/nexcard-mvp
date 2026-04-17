import React, { useEffect, useState } from 'react';
import { Package, MapPin, CheckCircle2, Clock, Truck, AlertCircle, ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const CARRIER_NAMES = {
  blueexpress: 'BlueExpress',
  chilexpress: 'Chilexpress',
  starken: 'Starken',
  correos: 'Correos de Chile',
  dhl: 'DHL',
  fedex: 'FedEx',
  manual: 'Courier',
};

const STATUS_CONFIG = {
  received:          { label: 'Recibido en bodega', icon: Package,       color: 'text-sky-500',     bg: 'bg-sky-50',     dot: 'bg-sky-500' },
  in_transit:        { label: 'En tránsito',        icon: Truck,         color: 'text-indigo-500',  bg: 'bg-indigo-50',  dot: 'bg-indigo-500' },
  out_for_delivery:  { label: 'En reparto',         icon: Truck,         color: 'text-amber-500',   bg: 'bg-amber-50',   dot: 'bg-amber-500' },
  delivered:         { label: 'Entregado',          icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  failed_attempt:    { label: 'Intento fallido',    icon: AlertCircle,   color: 'text-rose-500',    bg: 'bg-rose-50',    dot: 'bg-rose-500' },
  returned:          { label: 'Devuelto',           icon: AlertCircle,   color: 'text-rose-500',    bg: 'bg-rose-50',    dot: 'bg-rose-500' },
  unknown:           { label: 'En proceso',         icon: Clock,         color: 'text-zinc-400',    bg: 'bg-zinc-50',    dot: 'bg-zinc-400' },
  pending_credentials: { label: 'En proceso',       icon: Clock,         color: 'text-zinc-400',    bg: 'bg-zinc-50',    dot: 'bg-zinc-400' },
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

// Fulfillment pipeline visual
const PIPELINE = ['in_production', 'ready', 'shipped', 'delivered'];
const PIPELINE_LABELS = { in_production: 'Producción', ready: 'Listo', shipped: 'Despachado', delivered: 'Entregado' };

const TrackingPage = ({ orderId }) => {
  const [tracking, setTracking] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Load order basic info — handle invalid UUID gracefully
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('id, customer_name, fulfillment_status, carrier, tracking_code, shipped_at, delivered_at, delivery_address')
          .eq('id', orderId)
          .maybeSingle(); // maybeSingle returns null instead of throwing when not found

        if (orderErr) {
          // Invalid UUID or other query error — treat as not found
          setOrder(null);
          setLoading(false);
          return;
        }

        setOrder(orderData || null);

        if (!orderData) {
          setLoading(false);
          return;
        }

        // Load live tracking from Edge Function
        const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
        const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

        if (SUPABASE_URL && ANON_KEY) {
          const res = await fetch(
            `${SUPABASE_URL}/functions/v1/get-tracking?order_id=${orderId}`,
            { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
          );

          if (res.ok) {
            const data = await res.json();
            setTracking(data);
          }
        }
      } catch (err) {
        setError('No se pudo cargar el seguimiento. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 grid place-items-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-white font-bold">Cargando seguimiento…</p>
        </div>
      </div>
    );
  }

  if (!order && !loading) {
    return (
      <div className="min-h-screen bg-zinc-50 grid place-items-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-rose-500" />
          </div>
          <h1 className="text-xl font-black text-zinc-950 mb-2">Orden no encontrada</h1>
          <p className="text-zinc-500 font-medium text-sm">Verifica que el enlace sea correcto.</p>
        </div>
      </div>
    );
  }

  const currentStatus = tracking?.current_status || 'unknown';
  const statusConfig  = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.unknown;
  const StatusIcon    = statusConfig.icon;
  const pipelineStep  = PIPELINE.indexOf(order?.fulfillment_status);
  const carrierName   = CARRIER_NAMES[order?.carrier] || order?.carrier || '—';
  const shortId       = String(orderId).slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">

      {/* Header */}
      <div className="bg-zinc-950 px-6 py-5">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">NexCard</p>
            <h1 className="text-white font-black text-xl mt-0.5">Seguimiento de pedido</h1>
          </div>
          <a href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-bold transition-colors">
            <ArrowLeft size={16} />
            Inicio
          </a>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Order summary card */}
        <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Pedido</p>
              <p className="font-black text-zinc-950 text-lg">#{shortId}</p>
              <p className="text-sm font-medium text-zinc-500 mt-0.5">{order?.customer_name}</p>
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl ${statusConfig.bg}`}>
              <StatusIcon size={16} className={statusConfig.color} />
              <span className={`text-sm font-black ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
          </div>

          {/* Pipeline steps */}
          <div className="mt-6">
            <div className="flex items-center gap-0">
              {PIPELINE.map((step, i) => {
                const done    = pipelineStep > i;
                const active  = pipelineStep === i;
                const isLast  = i === PIPELINE.length - 1;
                return (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all
                        ${done ? 'bg-emerald-500 text-white' : active ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                        {done ? <CheckCircle2 size={14} /> : i + 1}
                      </div>
                      <span className={`mt-1.5 text-[10px] font-black text-center max-w-[52px] leading-tight
                        ${done || active ? 'text-zinc-900' : 'text-zinc-400'}`}>
                        {PIPELINE_LABELS[step]}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`flex-1 h-0.5 mb-4 ${done ? 'bg-emerald-500' : 'bg-zinc-100'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Carrier info */}
        {order?.carrier && (
          <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Datos de envío</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-zinc-500">Courier</span>
                <span className="text-sm font-black text-zinc-900">{carrierName}</span>
              </div>
              {order.tracking_code && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-500">Código</span>
                  <span className="text-sm font-black text-zinc-900 font-mono">{order.tracking_code}</span>
                </div>
              )}
              {order.delivery_address && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-sm font-bold text-zinc-500 shrink-0">Dirección</span>
                  <span className="text-sm font-medium text-zinc-700 text-right">{order.delivery_address}</span>
                </div>
              )}
              {order.shipped_at && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-500">Despachado</span>
                  <span className="text-sm font-medium text-zinc-700">{formatDate(order.shipped_at)}</span>
                </div>
              )}
              {tracking?.estimated_delivery && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-500">Entrega estimada</span>
                  <span className="text-sm font-black text-emerald-600">{tracking.estimated_delivery}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Tracking events timeline */}
        {tracking?.tracking_available && tracking.events?.length > 0 && (
          <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-5">Historial de envío</p>
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-zinc-100" />
              <div className="space-y-5">
                {tracking.events.map((event, i) => {
                  const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.unknown;
                  return (
                    <div key={i} className="flex gap-4 relative">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${i === 0 ? cfg.bg : 'bg-zinc-100'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? cfg.dot : 'bg-zinc-300'}`} />
                      </div>
                      <div className="pt-0.5 pb-1">
                        <p className={`text-sm font-black ${i === 0 ? 'text-zinc-950' : 'text-zinc-600'}`}>{event.description}</p>
                        {event.location && (
                          <p className="flex items-center gap-1 text-xs text-zinc-400 font-medium mt-0.5">
                            <MapPin size={11} /> {event.location}
                          </p>
                        )}
                        <p className="text-xs text-zinc-400 font-medium mt-0.5">{formatDate(event.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* No tracking yet */}
        {!tracking?.tracking_available && !loading && (
          <div className="bg-white rounded-[28px] border border-dashed border-zinc-200 p-8 text-center">
            <Truck size={28} className="text-zinc-300 mx-auto mb-3" />
            <p className="font-black text-zinc-700 mb-1">El seguimiento estará disponible pronto</p>
            <p className="text-sm font-medium text-zinc-400">Una vez que el paquete sea escaneado por {carrierName}, aparecerán los eventos aquí.</p>
          </div>
        )}

        {/* Delivery confirmation CTA */}
        {order?.fulfillment_status === 'shipped' && (
          <div className="bg-zinc-950 rounded-[28px] p-6 text-white">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">¿Ya llegó?</p>
            <p className="text-sm font-medium text-zinc-300 mb-4">
              Cuando recibas tu tarjeta NexCard, confírmanos la entrega para completar la activación.
            </p>
            <p className="text-xs font-medium text-zinc-500">
              Revisa el email que te enviamos al despachar — tiene el link de confirmación personalizado.
            </p>
          </div>
        )}

        {order?.fulfillment_status === 'delivered' && order?.delivered_at && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[28px] p-6 flex items-center gap-4">
            <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
            <div>
              <p className="font-black text-emerald-800">Entregado el {formatDate(order.delivered_at)}</p>
              <p className="text-sm font-medium text-emerald-600 mt-0.5">¡Disfruta tu NexCard!</p>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">NexCard · nexcard.cl</p>
      </footer>
    </div>
  );
};

export default TrackingPage;
