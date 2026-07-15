import React, { useState } from 'react';
import { api } from '../services/api';
import { PROFILE_SLUG_RULES_MESSAGE, isValidProfileSlug, slugify } from '../utils/slug';
import { 
  Zap, 
  User, 
  Palette, 
  Link as LinkIcon,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Briefcase
} from 'lucide-react';

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0); // 0: Account Type
  const [reservedSlug] = useState(() => {
    try {
      return sessionStorage.getItem('nx_pending_profile_slug') || '';
    } catch {
      return '';
    }
  });
  const [slugStatus, setSlugStatus] = useState(reservedSlug ? 'reserved' : 'idle');
  const [slugError, setSlugError] = useState('');
  const [formData, setFormData] = useState({
    account_type: 'personal', // personal | business
    full_name: '',
    profession: '',
    slug: reservedSlug,
    bio: '',
    theme_color: '#10B981',
    whatsapp: '',
  });

  const profilePreset = formData.account_type === 'business'
    ? {
        title: 'Perfil Negocio',
        subtitle: 'Para vender más rápido, recibir contactos y ordenar la atención comercial.',
        namePlaceholder: 'Nombre del negocio o marca',
        professionPlaceholder: 'Rubro / propuesta comercial',
        bioPlaceholder: 'Ej: Ayudamos a empresas a resolver necesidades con una atención rápida y profesional...',
        whatsappHint: 'Ingresa el WhatsApp comercial donde quieres recibir oportunidades.',
      }
    : {
        title: 'Perfil Profesional',
        subtitle: 'Para networking, reuniones, marca personal y relaciones de largo plazo.',
        namePlaceholder: 'Tu nombre completo',
        professionPlaceholder: 'Profesión / especialidad',
        bioPlaceholder: 'Ej: Ayudo a empresas a ordenar procesos, vender mejor o tomar mejores decisiones...',
        whatsappHint: 'Ingresa tu WhatsApp principal para conversaciones y reuniones.',
      };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const checkSlugAvailability = async (slug) => {
    const candidate = slugify(slug);
    setSlugError('');

    if (!isValidProfileSlug(candidate)) {
      setSlugStatus('invalid');
      setSlugError(PROFILE_SLUG_RULES_MESSAGE);
      return false;
    }

    if (reservedSlug && candidate === reservedSlug) {
      setSlugStatus('reserved');
      return true;
    }

    setSlugStatus('checking');
    try {
      const result = await api.checkProfileSlugAvailability(candidate);
      setFormData((prev) => ({ ...prev, slug: result.slug || candidate }));
      setSlugStatus(result.available ? 'available' : 'taken');
      setSlugError(result.available ? '' : result.message || 'Ese usuario ya está ocupado. Prueba otro.');
      return !!result.available;
    } catch {
      setSlugStatus('invalid');
      setSlugError('No pudimos validar el usuario. Intenta nuevamente.');
      return false;
    }
  };

  const handleNameChange = (value) => {
    setFormData((prev) => {
      if (reservedSlug || prev.slug) return { ...prev, full_name: value };
      return { ...prev, full_name: value, slug: slugify(value) };
    });
    if (!reservedSlug) {
      setSlugStatus('idle');
      setSlugError('');
    }
  };

  const handleSlugChange = (value) => {
    setFormData((prev) => ({ ...prev, slug: slugify(value) }));
    setSlugStatus('idle');
    setSlugError('');
  };

  const handleFinish = async () => {
    const slug = slugify(formData.slug || formData.full_name || '');
    const available = await checkSlugAvailability(slug);
    if (!available) return;
    onComplete({ ...formData, slug });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 text-white font-sans flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        
        {/* Progress Bar */}
        <div className="flex gap-2 mb-12">
          {[0, 1, 2, 3, 4].map(i => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-emerald-500' : 'bg-zinc-800'}`}
            ></div>
          ))}
        </div>

        {/* STEP 0: Account Type */}
        {step === 0 && (
          <div className="animate-in slide-in-from-right-4 duration-500">
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Elige tu línea NexCard.</h1>
            <p className="mt-4 text-zinc-400 font-medium">Configuraremos tu experiencia base según el tipo de perfil que quieres vender.</p>
            
            <div className="mt-10 space-y-4">
              <button 
                onClick={() => { setFormData({...formData, account_type: 'personal'}); nextStep(); }}
                className={`w-full p-6 rounded-[24px] border-2 text-left transition-all flex items-center gap-5 ${formData.account_type === 'personal' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
              >
                <div className={`p-3 rounded-xl ${formData.account_type === 'personal' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <User size={24} />
                </div>
                <div>
                  <p className="font-black text-lg">Perfil Profesional</p>
                  <p className="text-sm text-zinc-400 font-medium">Para consultores, ejecutivos, freelancers y networking profesional.</p>
                </div>
              </button>

              <button 
                onClick={() => { setFormData({...formData, account_type: 'business'}); nextStep(); }}
                className={`w-full p-6 rounded-[24px] border-2 text-left transition-all flex items-center gap-5 ${formData.account_type === 'business' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
              >
                <div className={`p-3 rounded-xl ${formData.account_type === 'business' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Building2 size={24} />
                </div>
                <div>
                  <p className="font-black text-lg">Perfil Negocio</p>
                  <p className="text-sm text-zinc-400 font-medium">Para pymes, equipos comerciales, locales y atención orientada a conversión.</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <div className="animate-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 mb-8">
              <Briefcase size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter leading-tight">{profilePreset.title}</h1>
            <p className="mt-4 text-zinc-400 font-medium">{profilePreset.subtitle}</p>
            
            <div className="mt-10 space-y-4">
              <input 
                data-cy="wizard-name"
                type="text" 
                placeholder={profilePreset.namePlaceholder}
                value={formData.full_name}
                onChange={e => handleNameChange(e.target.value)}
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-5 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
              />
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-1">Usuario público</span>
                <div className="mt-2 flex rounded-2xl border-2 border-zinc-800 bg-zinc-900 focus-within:border-emerald-500 transition-all overflow-hidden">
                  <span className="px-5 py-5 text-zinc-500 font-bold border-r border-zinc-800">nexcard.cl/</span>
                  <input
                    data-cy="wizard-slug"
                    type="text"
                    placeholder="tu-usuario"
                    value={formData.slug}
                    onBlur={() => checkSlugAvailability(formData.slug)}
                    onChange={e => handleSlugChange(e.target.value)}
                    className="flex-1 bg-transparent px-5 py-5 text-lg font-bold outline-none"
                  />
                </div>
                {slugStatus === 'reserved' ? <p className="mt-2 text-xs font-bold text-emerald-400">Usuario reservado por tu compra.</p> : null}
                {slugStatus === 'available' ? <p className="mt-2 text-xs font-bold text-emerald-400">Usuario disponible.</p> : null}
                {slugStatus === 'checking' ? <p className="mt-2 text-xs font-bold text-zinc-400">Validando disponibilidad…</p> : null}
                {slugError ? <p className="mt-2 text-xs font-bold text-rose-400">{slugError}</p> : null}
              </label>
              <input 
                data-cy="wizard-profession"
                type="text" 
                placeholder={profilePreset.professionPlaceholder}
                value={formData.profession}
                onChange={e => setFormData({...formData, profession: e.target.value})}
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-5 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Bio (Optional) */}
        {step === 2 && (
          <div className="animate-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 mb-8">
              <Zap size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Refina tu propuesta.</h1>
            <p className="mt-4 text-zinc-400 font-medium">Una bio breve ayuda a que tu perfil se entienda mejor desde el primer toque.</p>
            
            <div className="mt-10">
              <textarea 
                placeholder={profilePreset.bioPlaceholder}
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                rows="4"
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-5 text-lg font-bold focus:border-emerald-500 outline-none transition-all resize-none"
              ></textarea>
            </div>
          </div>
        )}

        {/* STEP 3: Color Selection */}
        {step === 3 && (
          <div className="animate-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 mb-8">
              <Palette size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Tu Color de Marca.</h1>
            <p className="mt-4 text-zinc-400 font-medium">Elige un color predeterminado o selecciona el tuyo.</p>
            
            <div className="mt-10">
              <div className="flex flex-wrap gap-4 mb-8">
                {['#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#000000', '#FFFFFF'].map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData({...formData, theme_color: color})}
                    className={`w-14 h-14 rounded-2xl border-4 transition-all ${formData.theme_color === color ? 'scale-110 border-emerald-500' : 'border-zinc-800'}`}
                    style={{ backgroundColor: color }}
                  ></button>
                ))}
              </div>
              
              <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border-2 border-zinc-800">
                <input 
                  type="color" 
                  value={formData.theme_color}
                  onChange={e => setFormData({...formData, theme_color: e.target.value})}
                  className="w-12 h-12 rounded-lg border-none cursor-pointer bg-transparent"
                />
                <span className="font-bold text-zinc-400 uppercase">Personalizar color: {formData.theme_color}</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: WhatsApp */}
        {step === 4 && (
          <div className="animate-in slide-in-from-right-4 duration-500">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 mb-8">
              <LinkIcon size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Línea directa.</h1>
            <p className="mt-4 text-zinc-400 font-medium">{profilePreset.whatsappHint}</p>
            
            <div className="mt-10">
              <input 
                data-cy="wizard-whatsapp"
                type="text" 
                placeholder="WhatsApp (ej: 56912345678)"
                value={formData.whatsapp}
                onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-5 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="mt-16 flex gap-4">
          {step > 0 && (
            <button 
              onClick={prevStep}
              className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          
          {step < 4 ? (
            <button 
              disabled={step === 1 && (!formData.full_name || !isValidProfileSlug(formData.slug) || ['taken', 'invalid', 'checking'].includes(slugStatus))}
              onClick={nextStep}
              className="flex-1 bg-white text-zinc-950 p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
            >
              Siguiente
              <ArrowRight size={24} />
            </button>
          ) : (
            <button 
              onClick={handleFinish}
              className="flex-1 bg-emerald-500 text-white p-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Finalizar NexCard
              <CheckCircle2 size={24} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default SetupWizard;
