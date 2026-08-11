import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import SafeErrorState from './common/SafeErrorState';

const ActivationPage = ({ token, user, onAuthRequired, onContinueSetup }) => {
  const [loading, setLoading] = useState(true);
  const [claimData, setClaimData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.previewProfileClaim(token)
      .then((data) => {
        if (!mounted) return;
        setClaimData(data);
      })
      .catch(() => {
        if (!mounted) return;
        setError(activationHelpMessage);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [token]);

  const activationErrorTitle = error?.includes('otro correo comprador')
    ? 'Ingresa con el correo de la compra'
    : 'Link de activación inválido o expirado';
  const activationErrorMessage = error || 'Revisa el enlace o solicita uno nuevo al equipo NexCard.';
  const activationHelpMessage = 'Revisa el enlace o solicita uno nuevo al equipo NexCard.';

  const handleActivate = async () => {
    const buyerEmail = claimData?.claim?.customer_email || '';
    if (!user) {
      onAuthRequired?.(token, buyerEmail);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await api.claimProfile(token);
      setClaimData(result);
      if (result.requires_profile_setup) {
        onContinueSetup?.({ token, reservedSlug: result.reserved_slug || result.order?.card_customization?.desired_slug || '' });
      }
    } catch (err) {
      if (err?.code === 'AUTH_REQUIRED' || err?.status === 401) {
        onAuthRequired?.(token, buyerEmail);
        return;
      }
      setError(err?.message || activationHelpMessage);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  if (error) {
    return (
      <SafeErrorState
        eyebrow="Activación NexCard"
        title={activationErrorTitle}
        message={activationErrorMessage}
        actionLabel="Volver al inicio"
        actionHref="/preview"
      />
    );
  }

  const order = claimData?.order;
  const claim = claimData?.claim;
  const suggestedSlug = claimData?.reserved_slug || order?.card_customization?.desired_slug || '';
  const alreadyClaimed = claim?.already_claimed || claim?.status === 'claimed';
  const canRetryClaim = !!user;
  const disableActivate = busy || (alreadyClaimed && !canRetryClaim);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <ShieldCheck size={72} className="mx-auto text-emerald-400 mb-4" />
          <h1 className="text-4xl font-black mb-2">Activa tu NexCard</h1>
          <p className="text-zinc-400 text-lg">Conecta tu compra con tu perfil digital.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div>
            <p className="text-zinc-400 text-sm mb-1">Orden</p>
            <p className="font-bold text-lg">{order?.folio || order?.id}</p>
          </div>
          <div>
            <p className="text-zinc-400 text-sm mb-1">Email comprador</p>
            <p className="font-semibold">{claim?.customer_email}</p>
          </div>
          <div>
            <p className="text-zinc-400 text-sm mb-1">Tarjetas incluidas</p>
            <p className="font-semibold">{claim?.quantity}</p>
          </div>

          {suggestedSlug ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5" data-cy="activation-suggested-slug">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Usuario sugerido listo</p>
              <p className="mt-2 text-2xl font-black text-white">nexcard.cl/{suggestedSlug}</p>
              <p className="mt-2 text-sm text-emerald-100/90">
                Reservamos este slug desde la compra/admin para que al activar no tengas que crear “otra cuenta” ni elegir desde cero.
              </p>
            </div>
          ) : null}

          {alreadyClaimed ? (
            <div className="bg-emerald-950 border border-emerald-700 rounded-xl p-5 flex gap-3">
              <CheckCircle2 className="text-emerald-400" />
              <div>
                <p className="font-bold">Esta NexCard ya fue reclamada.</p>
                <p className="text-sm text-emerald-200">
                  {user
                    ? 'Si esta activación quedó a medio camino, vuelve a continuar con tu cuenta para completar el perfil.'
                    : 'Ingresa con la cuenta que hizo la activación para continuar editando o terminar el setup.'}
                </p>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-rose-400 font-bold text-sm">{error}</p> : null}

          <button
            onClick={handleActivate}
            disabled={disableActivate}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all"
          >
            {busy ? <Loader2 className="animate-spin" /> : !user ? 'Crear acceso y activar NexCard' : alreadyClaimed && user ? 'Continuar activación' : 'Activar mi NexCard'}
            {!busy ? <ArrowRight size={20} /> : null}
          </button>

          {!user ? <p className="text-xs text-zinc-500 text-center">Crearás tu acceso NexCard para administrar tu perfil digital y activar esta compra.</p> : null}
          {alreadyClaimed && user ? <p className="text-xs text-zinc-500 text-center">Reintentaremos el vínculo con tu perfil actual para que puedas terminar el setup.</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ActivationPage;
