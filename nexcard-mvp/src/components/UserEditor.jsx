import React, { useState } from 'react';
import {
  Save,
  User,
  Palette,
  Link as LinkIcon,
  CreditCard,
  LogOut,
  Image as ImageIcon,
  CheckCircle2,
  ChevronRight,
  Settings,
  TrendingUp,
  Loader2,
  LayoutTemplate
} from 'lucide-react';
import { uploadAvatar } from '../utils/imageEngine';

const UserEditor = ({ data, onSave, onLogout }) => {
  const [profile, setProfile] = useState(data);
  const [activeTab, setActiveTab] = useState('stats');
  const [showSavedAlert, setShowSavedAlert] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const newUrl = await uploadAvatar('user_123', file);
      handleChange('avatar_url', newUrl);
    } catch (error) {
      console.error('Error subiendo imagen:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(profile);
    setSaving(false);
    setShowSavedAlert(true);
    setTimeout(() => setShowSavedAlert(false), 3000);
  };

  const tabs = [
    { id: 'stats', label: 'Stats', icon: TrendingUp },
    { id: 'basic', label: 'Básico', icon: User },
    { id: 'design', label: 'Diseño', icon: Palette },
    { id: 'links', label: 'Enlaces', icon: LinkIcon },
    { id: 'bank', label: 'Pago', icon: CreditCard },
    { id: 'content', label: 'Landing', icon: LayoutTemplate },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-20">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white">
              <Settings size={18} />
            </div>
            <span className="font-black text-lg tracking-tight">Editor NexCard</span>
          </div>
           <div className="flex gap-3">
            <button data-cy="logout" onClick={onLogout} className="p-2 text-zinc-400 hover:text-zinc-950 transition-colors">
              <LogOut size={20} />
            </button>
            <button
              onClick={handleSave}
              data-cy="save-profile"
              className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Guardar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-8">
        {showSavedAlert && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 animate-in slide-in-from-top-2">
            <CheckCircle2 size={20} />
            <span className="font-bold text-sm">Cambios guardados correctamente en NexCard.</span>
          </div>
        )}

        <div className="flex bg-zinc-200/50 p-1.5 rounded-2xl mb-8 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm p-8 space-y-8">
          {activeTab === 'stats' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-2">
              <div className="text-center">
                <div className="inline-flex p-4 bg-emerald-50 rounded-3xl text-emerald-500 mb-4">
                  <TrendingUp size={32} />
                </div>
                <h2 className="text-4xl font-black text-zinc-950">{profile.view_count || 0}</h2>
                <p className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest mt-1">Interacciones Totales (Taps)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Estado perfil</p>
                  <p className="text-xl font-black text-emerald-500 uppercase">{profile.status || 'active'}</p>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cuenta</p>
                  <p className="text-xl font-black text-blue-500 uppercase">{profile.account_type || 'individual'}</p>
                </div>
              </div>

              <div className="p-6 bg-zinc-950 rounded-[24px] text-white">
                <p className="text-xs font-bold opacity-50 mb-4">NexCard Insights</p>
                <p className="text-sm font-medium leading-relaxed">
                  Perfil ya conectado a una capa de API. Siguiente salto de valor: checkout real, roles persistentes y activación de pedidos.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="relative group">
                  <img src={profile.avatar_url} className={`w-24 h-24 rounded-full object-cover border-4 border-zinc-50 shadow-inner ${uploading ? 'opacity-50' : ''}`} alt="Preview" />
                  <label className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-zinc-100 text-zinc-400 hover:text-zinc-950 transition-all cursor-pointer">
                    <ImageIcon size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                  {uploading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>}
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{uploading ? 'Subiendo...' : 'Foto de Perfil'}</p>
              </div>

              <div className="space-y-4">
                <label className="block" data-cy="profile-name-label">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Nombre Completo</span>
                  <input id="profile-name" data-cy="profile-name" type="text" value={profile.full_name || ''} onChange={(e) => handleChange('full_name', e.target.value)} className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Cargo / Profesión</span>
                  <input type="text" value={profile.profession || ''} onChange={(e) => handleChange('profession', e.target.value)} className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Bio Corta</span>
                  <textarea value={profile.bio || ''} onChange={(e) => handleChange('bio', e.target.value)} rows="3" className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none"></textarea>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'design' && (
            <div className="space-y-8">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Color de Marca</span>
                <div className="mt-4 flex flex-wrap gap-4">
                  {['#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#000000'].map(color => (
                    <button key={color} onClick={() => handleChange('theme_color', color)} className={`w-12 h-12 rounded-2xl border-4 transition-all ${profile.theme_color === color ? 'scale-110 border-white ring-2 ring-zinc-950' : 'border-transparent'}`} style={{ backgroundColor: color }}></button>
                  ))}
                  <input type="color" value={profile.theme_color || '#10B981'} onChange={(e) => handleChange('theme_color', e.target.value)} className="w-12 h-12 p-0 rounded-2xl border-none cursor-pointer overflow-hidden" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                <div>
                  <p className="font-bold text-sm text-zinc-950">Modo Oscuro</p>
                  <p className="text-xs text-zinc-400 font-medium">Fondo negro premium para tu perfil</p>
                </div>
                <button onClick={() => handleChange('is_dark_mode', !profile.is_dark_mode)} className={`w-12 h-6 rounded-full transition-colors relative ${profile.is_dark_mode ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${profile.is_dark_mode ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-6">
              {[
                ['whatsapp', 'WhatsApp (con código de país)', 'Ej: 56912345678'],
                ['instagram', 'Instagram (Usuario)', '@usuario'],
                ['linkedin', 'LinkedIn', 'perfil-linkedin'],
                ['website', 'Sitio Web', 'https://...'],
                ['calendar_url', 'URL Agenda', 'https://calendly.com/...'],
              ].map(([field, label, placeholder]) => (
                <label key={field} className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">{label}</span>
                  <input type="text" placeholder={placeholder} value={profile[field] || ''} onChange={(e) => handleChange(field, e.target.value)} className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold" />
                </label>
              ))}
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div>
                  <p className="font-bold text-sm text-emerald-950">Mostrar Datos Bancarios</p>
                  <p className="text-xs text-emerald-600/80 font-medium">Habilita el acordeón de transferencia</p>
                </div>
                <button data-cy="bank-toggle" onClick={() => handleChange('bank_enabled', !profile.bank_enabled)} className={`w-12 h-6 rounded-full transition-colors relative ${profile.bank_enabled ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${profile.bank_enabled ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              {profile.bank_enabled && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  {[
                    ['bank_name', 'Banco'],
                    ['bank_type', 'Tipo de Cuenta'],
                    ['bank_number', 'Número de Cuenta'],
                    ['bank_rut', 'RUT'],
                    ['bank_email', 'Email'],
                  ].map(([field, placeholder]) => (
                    <input key={field} placeholder={placeholder} value={profile[field] || ''} onChange={(e) => handleChange(field, e.target.value)} className="w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold" />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6">
              <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-sm font-bold text-zinc-950">Estado del CMS</p>
                <p className="text-sm text-zinc-500 mt-2">La base ya quedó lista para manejar contenido editable de landing vía API. El siguiente paso es exponer este bloque desde un panel admin separado con permisos por rol.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-zinc-950 text-white">
                  <p className="text-xs uppercase tracking-widest text-zinc-500 font-black mb-2">Ahora</p>
                  <p className="font-bold">Perfil editable del cliente</p>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-zinc-100">
                  <p className="text-xs uppercase tracking-widest text-zinc-400 font-black mb-2">Siguiente fase</p>
                  <p className="font-bold text-zinc-950">Landing comercial editable desde admin</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <a href={`/${profile.slug || 'carlos-alvarez'}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-zinc-400 hover:text-emerald-500 font-bold text-xs uppercase tracking-widest transition-all">
            Ver Vista Previa de mi NexCard
            <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default UserEditor;
