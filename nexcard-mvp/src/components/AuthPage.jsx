import React, { useState } from 'react';
import {
  Zap,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  ShieldCheck,
  ChevronLeft,
  KeyRound,
} from 'lucide-react';
import { api } from '../services/api';
import {
  AUTH_MODES,
  buildPasswordResetRedirectTo,
  buildSignupConfirmationRedirectTo,
  getInitialAuthMode,
  normalizeAuthEmail,
  validatePasswordResetForm,
} from '../utils/authFlow';

const EMAIL_NOT_CONFIRMED_MESSAGE = 'Tu cuenta fue creada, pero falta confirmar el correo. Abre el email de confirmación de Supabase/NexCard y luego vuelve a iniciar sesión para activar tu NexCard.';

const isEmailNotConfirmedError = (message = '') => /email not confirmed/i.test(message);

const getCopy = (mode, hasPendingClaim = false) => {
  if (mode === AUTH_MODES.REGISTER) {
    if (hasPendingClaim) {
      return {
        title: 'Crea tu acceso NexCard.',
        description: 'Define tu contraseña para activar la NexCard asociada a este correo.',
        submit: 'Crear cuenta y activar NexCard',
      };
    }
    return {
      title: 'Crea tu NexCard.',
      description: 'Registro habilitado con Supabase. Te enviaremos un correo para confirmar la cuenta.',
      submit: 'Registrarme',
    };
  }
  if (mode === AUTH_MODES.REQUEST_RESET) {
    return {
      title: 'Restablece tu contraseña.',
      description: 'Ingresa tu correo y te enviaremos un link seguro para crear una contraseña nueva.',
      submit: 'Enviar link de recuperación',
    };
  }
  if (mode === AUTH_MODES.RESET_PASSWORD) {
    return {
      title: 'Crea una contraseña nueva.',
      description: 'Estás usando un link seguro de recuperación. Define tu nueva contraseña para volver a entrar.',
      submit: 'Actualizar contraseña',
    };
  }
  return {
    title: 'Bienvenido de nuevo.',
    description: 'Accede a tu panel y administra tu perfil, pedidos y operación.',
    submit: 'Entrar',
  };
};

const AuthPage = ({ onAuthSuccess, pendingClaimToken, pendingClaimEmail = '' }) => {
  const hasPendingClaim = !!pendingClaimToken;
  const lockedClaimEmail = hasPendingClaim ? normalizeAuthEmail(pendingClaimEmail) : '';
  const [mode, setMode] = useState(() => getInitialAuthMode(window.location.search, { hasPendingClaim }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [formData, setFormData] = useState({
    email: lockedClaimEmail,
    password: '',
    confirmPassword: '',
  });

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setConfirmationPending(false);
    setFormData((current) => ({ ...current, password: '', confirmPassword: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    setConfirmationPending(false);

    try {
      if (mode === AUTH_MODES.REQUEST_RESET) {
        await api.requestPasswordReset({
          email: normalizeAuthEmail(formData.email),
          redirectTo: buildPasswordResetRedirectTo(window.location.href),
        });
        setNotice('Si el correo existe en NexCard, te enviaremos un link para restablecer tu contraseña. Revisa también spam/promociones.');
        return;
      }

      if (mode === AUTH_MODES.RESET_PASSWORD) {
        const validationError = validatePasswordResetForm(formData.password, formData.confirmPassword);
        if (validationError) {
          setError(validationError);
          return;
        }
        await api.updatePassword({ password: formData.password });
        switchMode(AUTH_MODES.LOGIN);
        setNotice('Contraseña actualizada. Ya puedes iniciar sesión con tu nueva clave.');
        return;
      }

      const isContextualRegister = mode === AUTH_MODES.REGISTER && hasPendingClaim;
      if (isContextualRegister) {
        const validationError = validatePasswordResetForm(formData.password, formData.confirmPassword);
        if (validationError) {
          setError(validationError);
          return;
        }
      }

      const authPayload = mode === AUTH_MODES.REGISTER
        ? await api.register({
          ...formData,
          email: normalizeAuthEmail(formData.email),
          redirectTo: isContextualRegister ? buildSignupConfirmationRedirectTo(window.location.href) : undefined,
        })
        : await api.login({ ...formData, email: normalizeAuthEmail(formData.email) });

      if (mode === AUTH_MODES.REGISTER && authPayload.needsEmailConfirmation) {
        setConfirmationPending(true);
        setNotice('Cuenta creada. Te enviamos un correo de confirmación; confirma ese email y luego vuelve aquí para iniciar sesión y activar tu NexCard.');
        return;
      }

      onAuthSuccess(authPayload);
    } catch (err) {
      if (isEmailNotConfirmedError(err.message)) {
        setConfirmationPending(true);
        setError(EMAIL_NOT_CONFIRMED_MESSAGE);
        return;
      }
      setError(err.message || 'No fue posible iniciar sesión/registro');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await api.resendSignupConfirmation({
        email: normalizeAuthEmail(formData.email),
        redirectTo: buildSignupConfirmationRedirectTo(window.location.href),
      });
      setConfirmationPending(true);
      setNotice('Reenviamos el correo de confirmación. Confírmalo y luego vuelve a iniciar sesión para activar tu NexCard.');
    } catch (err) {
      setError(err.message || 'No fue posible reenviar el correo de confirmación.');
    } finally {
      setLoading(false);
    }
  };

  const copy = getCopy(mode, hasPendingClaim);
  const needsPassword = mode !== AUTH_MODES.REQUEST_RESET;
  const needsConfirmPassword = mode === AUTH_MODES.RESET_PASSWORD || (mode === AUTH_MODES.REGISTER && hasPendingClaim);
  const isPasswordRecovery = mode === AUTH_MODES.REQUEST_RESET || mode === AUTH_MODES.RESET_PASSWORD;
  const shouldLockEmail = !!lockedClaimEmail && mode !== AUTH_MODES.RESET_PASSWORD && hasPendingClaim;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
            {isPasswordRecovery ? <KeyRound size={32} /> : <Zap size={32} fill="currentColor" />}
          </div>
          <h1 className="text-4xl font-black tracking-tighter leading-tight">
            {copy.title}
          </h1>
          <p className="mt-3 text-zinc-400 font-medium">
            {copy.description}
            {pendingClaimToken ? ' Estás entrando para activar una NexCard comprada.' : ''}
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode !== AUTH_MODES.RESET_PASSWORD && (
              <div>
                <label htmlFor="auth-email" className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    id="auth-email"
                    data-cy="auth-email"
                    type="email"
                    required
                    placeholder="ejemplo@correo.com"
                    value={formData.email}
                    readOnly={shouldLockEmail}
                    aria-readonly={shouldLockEmail}
                    onChange={(e) => {
                      if (shouldLockEmail) return;
                      setFormData({ ...formData, email: e.target.value });
                    }}
                    className="w-full bg-zinc-800/50 border-2 border-white/5 rounded-2xl pl-12 pr-6 py-4 font-bold focus:border-emerald-500 outline-none transition-all read-only:text-zinc-300 read-only:cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            {needsPassword && (
              <div>
                <label htmlFor="auth-password" className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">
                  {mode === AUTH_MODES.RESET_PASSWORD ? 'Nueva contraseña' : 'Contraseña'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    id="auth-password"
                    data-cy="auth-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-zinc-800/50 border-2 border-white/5 rounded-2xl pl-12 pr-6 py-4 font-bold focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {needsConfirmPassword && (
              <div>
                <label htmlFor="auth-confirm-password" className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">{mode === AUTH_MODES.REGISTER ? 'Confirmar contraseña' : 'Confirmar nueva contraseña'}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    id="auth-confirm-password"
                    data-cy="auth-confirm-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-zinc-800/50 border-2 border-white/5 rounded-2xl pl-12 pr-6 py-4 font-bold focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm font-bold text-rose-400" data-cy="auth-error">{error}</p>}
            {notice && <p className="text-sm font-bold text-emerald-300" data-cy="auth-notice">{notice}</p>}
            {confirmationPending && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100" data-cy="auth-email-confirmation-pending">
                <p className="font-black text-amber-200">Falta confirmar tu correo antes de ingresar.</p>
                <p className="mt-1 text-amber-100/90">Después de confirmar, vuelve a esta pantalla y usa “Ya tengo cuenta, iniciar sesión”.</p>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={loading}
                  className="mt-3 text-xs font-black uppercase tracking-widest text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                >
                  Reenviar correo de confirmación
                </button>
              </div>
            )}

            <button
              type="submit"
              data-cy="auth-submit"
              disabled={loading}
              className="w-full bg-white text-zinc-950 p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : copy.submit}
              {!loading && <ArrowRight size={24} />}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center space-y-4">
            {mode === AUTH_MODES.LOGIN && (
              <button
                type="button"
                data-cy="auth-forgot-password"
                onClick={() => switchMode(AUTH_MODES.REQUEST_RESET)}
                className="block mx-auto text-sm font-bold text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <button
              type="button"
              onClick={() => switchMode(mode === AUTH_MODES.LOGIN ? AUTH_MODES.REGISTER : AUTH_MODES.LOGIN)}
              className="text-sm font-bold text-zinc-400 hover:text-white transition-colors"
            >
              {hasPendingClaim
                ? (mode === AUTH_MODES.LOGIN ? 'Crear cuenta para activar esta NexCard' : 'Ya tengo cuenta, iniciar sesión')
                : (mode === AUTH_MODES.LOGIN ? '¿No tienes cuenta? Regístrate' : 'Volver a iniciar sesión')}
            </button>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-zinc-600 text-xs font-bold uppercase tracking-widest">
          <ShieldCheck size={14} />
          Acceso Seguro vía Supabase Auth
        </div>

        <button
          onClick={() => { window.location.href = '/'; }}
          className="mt-8 mx-auto flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-sm font-bold"
        >
          <ChevronLeft size={16} /> Volver a la Landing
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
