import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

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
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'No fue posible validar el link de activación');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [token]);

  const handleActivate = async () => {
    if (!user) {
      onAuthRequired?.(token);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await api.claimProfile(token);
      setClaimData(result);
      if (result.requires_profile_setup) {
        onContinueSetup?.(token);
      }
    } catch (err) {
      setError(err.message || 'No fue posible activar tu NexCard');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  if (error) {
    return <div className="min-h-screen bg-zinc-950 text-white grid place-items-center p-8 text-center"><div><p className="text-2xl font-black mb-3">No pudimos activar tu NexCard</p><p className="text-zinc-400">{error}</p></div></div>;
  }

  const order = claimData?.order;
  const claim = claimData?.claim;
  const alreadyClaimed = claim?.already_claimed || claim?.status === 'claimed';

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

          {alreadyClaimed ? (
            <div className="bg-emerald-950 border border-emerald-700 rounded-xl p-5 flex gap-3">
              <CheckCircle2 className="text-emerald-400" />
              <div>
                <p className="font-bold">Esta NexCard ya fue reclamada.</p>
                <p className="text-sm text-emerald-200">Si tu perfil ya existe, entra con tu cuenta para seguir editándolo.</p>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-rose-400 font-bold text-sm">{error}</p> : null}

          <button
            onClick={handleActivate}
            disabled={busy || alreadyClaimed}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white p-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all"
          >
            {busy ? <Loader2 className="animate-spin" /> : 'Activar mi NexCard'}
            {!busy ? <ArrowRight size={20} /> : null}
          </button>

          {!user ? <p className="text-xs text-zinc-500 text-center">Si aún no tienes cuenta, te pediremos registrarte antes de activar.</p> : null}
        </div>
      </div>
    </div>
  );
};

export default ActivationPage;
