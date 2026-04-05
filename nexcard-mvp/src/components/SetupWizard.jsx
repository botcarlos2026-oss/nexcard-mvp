import React, { useState } from 'react';
import { 
  Zap, 
  ChevronRight, 
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
  const [formData, setFormData] = useState({
    account_type: 'personal', // personal | business
    full_name: '',
    profession: '',
    bio: '',
    theme_color: '#10B981',
    whatsapp: '',
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleFinish = () => {
    const generateSlug = (name) => name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const slug = generateSlug(formData.full_name || '');
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
            <h1 className="text-4xl font-black tracking-tighter leading-tight">¿Para quién es esta NexCard?</h1>
            <p className="mt-4 text-zinc-400 font-medium">Personalizaremos tu experiencia según tu perfil.</p>
            
            <div className="mt-10 space-y-4">
              <button 
                onClick={() => { setFormData({...formData, account_type: 'personal'}); nextStep(); }}
                className={`w-full p-6 rounded-[24px] border-2 text-left transition-all flex items-center gap-5 ${formData.account_type === 'personal' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
              >
                <div className={`p-3 rounded-xl ${formData.account_type === 'personal' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                  <User size={24} />
                </div>
                <div>
                  <p className="font-black text-lg">Uso Personal</p>
                  <p className="text-sm text-zinc-400 font-medium">Para profesionales independientes y networking.</p>
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
                  <p className="font-black text-lg">Empresa / Pyme</p>
                  <p className="text-sm text-zinc-400 font-medium">Para equipos de ventas, locales o flotas corporativas.</p>
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
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Comencemos con lo básico.</h1>
            <p className="mt-4 text-zinc-400 font-medium">¿Cómo quieres aparecer en tu perfil?</p>
            
            <div className="mt-10 space-y-4">
              <input 
                data-cy="wizard-name"
                type="text" 
                placeholder={formData.account_type === 'personal' ? "Tu Nombre Completo" : "Nombre de la Empresa"}
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-6 py-5 text-lg font-bold focus:border-emerald-500 outline-none transition-all"
              />
              <input 
                data-cy="wizard-profession"
                type="text" 
                placeholder={formData.account_type === 'personal' ? "Tu Profesión / Cargo" : "Rubro / Especialidad"}
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
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Cuéntales algo más.</h1>
            <p className="mt-4 text-zinc-400 font-medium">Bio corta (Opcional). Puedes saltar este paso.</p>
            
            <div className="mt-10">
              <textarea 
                placeholder="Ej: Ayudo a pymes a optimizar sus procesos digitales..."
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
            <h1 className="text-4xl font-black tracking-tighter leading-tight">Línea Directa.</h1>
            <p className="mt-4 text-zinc-400 font-medium">Ingresa tu número de WhatsApp para recibir contactos.</p>
            
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
              disabled={step === 1 && !formData.full_name}
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
