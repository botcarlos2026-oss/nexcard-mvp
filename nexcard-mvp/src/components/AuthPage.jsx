import React, { useState } from 'react';
import {
  Zap,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import { api } from '../services/api';

const AuthPage = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const authPayload = await api.login(formData);
      onAuthSuccess(authPayload);
    } catch (err) {
      setError(err.message || 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
            <Zap size={32} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter leading-tight">
            {mode === 'login' ? 'Bienvenido de nuevo.' : 'Crea tu NexCard.'}
          </h1>
          <p className="mt-3 text-zinc-400 font-medium">
            {mode === 'login'
              ? 'Accede a tu panel y administra tu perfil, pedidos y operación.'
              : 'La base visual está lista; el registro productivo vendrá en la siguiente fase.'}
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="email"
                  required
                  placeholder="ejemplo@correo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-zinc-800/50 border-2 border-white/5 rounded-2xl pl-12 pr-6 py-4 font-bold focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-2 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-zinc-800/50 border-2 border-white/5 rounded-2xl pl-12 pr-6 py-4 font-bold focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            {error && <p className="text-sm font-bold text-rose-400">{error}</p>}

            <div className="text-xs text-zinc-500 font-medium bg-zinc-800/40 p-4 rounded-2xl">
              Demo local:<br />
              admin@nexcard.cl / admin123<br />
              carlos@nexcard.cl / demo123
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-zinc-950 p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : mode === 'login' ? 'Entrar' : 'Comenzar Registro'}
              {!loading && <ArrowRight size={24} />}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm font-bold text-zinc-400 hover:text-white transition-colors"
            >
              {mode === 'login' ? '¿No tienes cuenta? Registro productivo en siguiente fase' : 'Volver al acceso'}
            </button>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-zinc-600 text-xs font-bold uppercase tracking-widest">
          <ShieldCheck size={14} />
          Acceso Seguro vía NexCard Sentinel
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
