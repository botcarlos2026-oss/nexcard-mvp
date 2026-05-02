import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Phone, 
  Instagram, 
  Linkedin, 
  Globe, 
  Calendar, 
  UserPlus, 
  ChevronDown, 
  Copy, 
  Check, 
  Share2,
  ExternalLink,
  MapPin,
  Mail,
  Facebook,
  CreditCard,
  FileText
} from 'lucide-react';
import { generateVCard } from '../utils/vCardEngine';
import { trackClick } from '../utils/analyticsEngine';
import LinkIcon from './LinkIcon';

const NexCardProfile = ({ data }) => {
  // NexReview: si es tarjeta de reseñas, redirigir inmediatamente
  if (data.card_type === 'review' && data.review_url) {
    window.location.replace(data.review_url);
    return (
      <div className="min-h-screen bg-zinc-950 grid place-items-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-bold text-sm">Redirigiendo a reseñas…</p>
        </div>
      </div>
    );
  }

  const [copiedField, setCopiedField] = useState(null);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', company: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    if (data?.slug && supabase) {
      supabase.from('card_scans').insert({ profile_slug: data.slug, profile_id: data.id || null }).then(() => {});
    }
  }, [data?.id]);

  // Default theme settings
  const themeColor = data.theme_color || '#10B981';
  const isDark = data.is_dark_mode !== undefined ? data.is_dark_mode : true;
  const slug = data.slug || 'carlos';

  const handleSaveContact = async () => {
    trackClick(slug, 'vcard');
    await generateVCard(data);
  };

  const handleLinkClick = (type) => {
    trackClick(slug, type);
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: data.full_name,
        text: data.profession,
        url: window.location.href,
      });
    }
  };

  const handleCopyAllBankData = () => {
    const textToCopy = `Datos de Transferencia:\nBanco: ${data.bank_name || ''}\nTipo: ${data.bank_type || ''}\nCuenta: ${data.bank_number || ''}\nRUT: ${data.bank_rut || ''}\nNombre: ${data.full_name || ''}\nEmail: ${data.contact_email || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedField('all_bank');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className={`min-h-screen font-sans ${isDark ? 'bg-zinc-950 text-white' : 'bg-gray-50 text-zinc-900'}`}>
      
      {/* Header Banner */}
      <div 
        className="relative h-32 w-full bg-cover bg-center"
        style={{ 
          backgroundImage: data.cover_image_url ? `url(${data.cover_image_url})` : 'none',
          backgroundColor: data.cover_image_url ? 'transparent' : themeColor
        }}
      >
        {!data.cover_image_url && (
           <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-black/0 via-black/10 to-black/30"></div>
        )}
        <button 
          onClick={handleShare}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/20 text-white hover:bg-black/30 transition-colors backdrop-blur-md"
        >
          <Share2 size={20} />
        </button>
      </div>

      {/* Profile Info Section */}
      <div className="max-w-md mx-auto px-6 pb-8 text-center -mt-16 relative z-10">
        <div className="relative inline-block group">
          {data.avatar_url ? (
            <img
              src={data.avatar_url}
              alt={data.full_name}
              className="w-32 h-32 rounded-full border-4 object-cover relative z-10 shadow-lg"
              style={{ borderColor: isDark ? '#09090b' : '#f9fafb' }}
            />
          ) : (
            <div
              className="w-32 h-32 rounded-full border-4 flex items-center justify-center text-4xl font-black text-white relative z-10 shadow-lg"
              style={{ backgroundColor: themeColor, borderColor: isDark ? '#09090b' : '#f9fafb' }}
            >
              {data.full_name?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{data.full_name}</h1>
        <p className="mt-1 text-lg opacity-80 font-medium">{data.profession}</p>
        
        {data.company && (
          <p className="mt-1 text-sm font-bold text-blue-500">
            {data.company}
          </p>
        )}
        
        {data.location && (
          <p className="mt-2 text-sm opacity-60 flex items-center justify-center gap-1">
            <MapPin size={14} />
            {data.location}
          </p>
        )}

        <p className="mt-4 text-sm opacity-80 leading-relaxed px-2 text-left">{data.bio}</p>

        {/* Action Buttons (Primary) */}
        <div className="mt-6 flex flex-col gap-3">
          {data.vcard_enabled !== false && (
            <button
              onClick={handleSaveContact}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-black/10"
              style={{ backgroundColor: themeColor, color: '#fff' }}
            >
              <UserPlus size={20} />
              Guardar Contacto
            </button>
          )}
          <button
            onClick={() => setContactModal(true)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
          >
            💬 Conectemos
          </button>
        </div>

        {/* Modal Conectemos */}
        {contactModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setContactModal(false)}>
            <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
              {contactSent ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-bold text-lg">¡Listo!</p>
                  <p className="text-sm opacity-60 mt-1">Te contactaremos pronto.</p>
                  <button onClick={() => { setContactModal(false); setContactSent(false); }} className="mt-4 text-sm opacity-50 hover:opacity-80">Cerrar</button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-lg mb-4">Conectemos</h3>
                  <div className="space-y-3">
                    <input type="text" placeholder="Tu nombre *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`} />
                    <input type="email" placeholder="Email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`} />
                    <input type="tel" placeholder="Teléfono" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`} />
                    <input type="text" placeholder="Empresa" value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`} />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setContactModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold opacity-50 hover:opacity-80">Cancelar</button>
                    <button
                      disabled={contactLoading || !contactForm.name.trim()}
                      onClick={async () => {
                        if (!contactForm.name.trim()) return;
                        setContactLoading(true);
                        try {
                          if (supabase) {
                            await supabase.from('crm_contacts').insert({ name: contactForm.name, email: contactForm.email || null, phone: contactForm.phone || null, company: contactForm.company || null, source: 'nfc_tap', profile_id: data.id || null });
                          }
                          setContactSent(true);
                        } catch { setContactSent(true); }
                        finally { setContactLoading(false); }
                      }}
                      className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: themeColor }}
                    >
                      {contactLoading ? 'Enviando…' : 'Enviar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6 pb-12">
        
        {/* Social Grid */}
        <div className="grid grid-cols-4 gap-3">
          {(data.whatsapp_enabled !== false && data.whatsapp) && (
            <a
              href={`https://wa.me/${data.whatsapp}`}
              onClick={() => handleLinkClick('whatsapp')}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-green-950 border-green-900' : 'bg-green-50 border-green-100'}`}
            >
              <Phone size={24} className="text-green-500" />
            </a>
          )}
          {(data.linkedin_enabled !== false && data.linkedin) && (
            <a 
              href={data.linkedin.startsWith('http') ? data.linkedin : `https://linkedin.com/in/${data.linkedin}`}
              onClick={() => handleLinkClick('linkedin')}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
            >
              <Linkedin size={24} className="text-blue-600" />
            </a>
          )}
          {(data.instagram_enabled !== false && data.instagram) && (
            <a 
              href={`https://instagram.com/${data.instagram}`}
              onClick={() => handleLinkClick('instagram')}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
            >
              <Instagram size={24} className="text-pink-500" />
            </a>
          )}
          {(data.facebook_enabled !== false && data.facebook) && (
            <a 
              href={data.facebook.startsWith('http') ? data.facebook : `https://facebook.com/${data.facebook}`}
              onClick={() => handleLinkClick('facebook')}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
            >
              <Facebook size={24} className="text-blue-500" />
            </a>
          )}
        </div>

        {/* Contact Info Blocks */}
        <div className="space-y-3">
          {(data.contact_phone_enabled !== false && data.contact_phone) && (
            <div className={`flex items-center p-4 rounded-2xl shadow-sm border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <Phone size={18} />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">Teléfono Múltiple</p>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.contact_phone}</p>
              </div>
            </div>
          )}
          
          {(data.contact_email_enabled !== false && data.contact_email) && (
            <div className={`flex items-center p-4 rounded-2xl shadow-sm border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">Correo Electrónico</p>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.contact_email}</p>
              </div>
            </div>
          )}

          {(data.website_enabled !== false && data.website_url) && (
            <div className={`flex items-center p-4 rounded-2xl shadow-sm border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <Globe size={18} />
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">Sitio Web</p>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.website_url.replace(/^https?:\/\//, '')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bank Details Accordion */}
        {data.bank_enabled !== false && (
          <div>
            <button 
              onClick={() => setIsBankOpen(!isBankOpen)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl shadow-sm border transition-all ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
            >
              <span className={`font-bold flex items-center gap-3 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                <CreditCard size={20} />
                Datos de Transferencia
              </span>
              <ChevronDown 
                size={20} 
                className={`text-zinc-400 transition-transform duration-300 ${isBankOpen ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {isBankOpen && (
              <div className={`mt-2 p-5 rounded-2xl shadow-sm border space-y-4 animate-in slide-in-from-top-2 duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                <div className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  <p><strong>Banco:</strong> {data.bank_name}</p>
                  <p><strong>Tipo:</strong> {data.bank_type}</p>
                  <p><strong>Cuenta:</strong> {data.bank_number}</p>
                  <p><strong>RUT:</strong> {data.bank_rut}</p>
                  <p><strong>Nombre:</strong> {data.full_name}</p>
                  <p><strong>Email:</strong> {data.contact_email}</p>
                </div>
                <button 
                  onClick={handleCopyAllBankData}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  {copiedField === 'all_bank' ? <Check size={18} /> : <Copy size={18} />}
                  {copiedField === 'all_bank' ? '¡Copiado!' : 'Copiar Todos los Datos'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Useful Links */}
        <div className="pt-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 px-2">Enlaces Útiles</h3>
          <div className="space-y-3">
            {(data.calendar_url_enabled !== false && data.calendar_url) && (
              <a
                href={data.calendar_url}
                onClick={() => handleLinkClick('calendar')}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between p-4 rounded-2xl shadow-sm border transition-all group ${isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center overflow-hidden">
                    <LinkIcon url={data.calendar_url} size={18} />
                  </div>
                  <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>Agendar Reunión</span>
                </div>
                <ExternalLink size={16} className="text-zinc-400 group-hover:text-blue-500" />
              </a>
            )}

            {(data.portfolio_enabled !== false && data.portfolio_url) && (
              <a
                href={data.portfolio_url}
                onClick={() => handleLinkClick('portfolio')}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between p-4 rounded-2xl shadow-sm border transition-all group ${isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center overflow-hidden">
                    <LinkIcon url={data.portfolio_url} size={18} />
                  </div>
                  <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>Portafolio</span>
                </div>
                <ExternalLink size={16} className="text-zinc-400 group-hover:text-blue-500" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Footer / Branding */}
      <footer className="max-w-md mx-auto pb-12 text-center opacity-30 flex flex-col items-center gap-2">
        <p className="text-xs font-bold tracking-widest uppercase">NexCard Sentinel</p>
        <div className="h-px w-8 bg-current opacity-20"></div>
      </footer>
    </div>
  );
};

export default NexCardProfile;
