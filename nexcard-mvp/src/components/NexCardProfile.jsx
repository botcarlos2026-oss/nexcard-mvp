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
  CreditCard
} from 'lucide-react';
import { generateVCard } from '../utils/vCardEngine';
import { trackClick } from '../utils/analyticsEngine';
import { safeExternalUrl, isGoogleReviewUrl } from '../utils/safeExternalUrl';
import LinkIcon from './LinkIcon';

// WCAG relative luminance (0 = black, 1 = white), used to detect a too-dark theme_color.
function getRelativeLuminance(hex) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255);
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

const NexCardProfile = ({ data }) => {
  const [copiedField, setCopiedField] = useState(null);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  // Kept intentionally short (name + one contact method) — a stranger who just met the profile
  // owner shouldn't be asked for email, phone, and company before deciding this is worth sharing.
  const [contactForm, setContactForm] = useState({ name: '', contact: '' });
  const [contactSent, setContactSent] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState('');
  const previouslyFocusedRef = React.useRef(null);
  const firstFieldRef = React.useRef(null);

  useEffect(() => {
    if (!contactModal) return;
    setContactError('');
    previouslyFocusedRef.current = document.activeElement;
    firstFieldRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setContactModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [contactModal]);

  const isReviewRedirect = data?.card_type === 'review' && isGoogleReviewUrl(data?.review_url);

  useEffect(() => {
    if (isReviewRedirect) {
      window.location.replace(data.review_url);
      return;
    }

    if (data?.slug && supabase) {
      // Scan tracking deshabilitado temporalmente — esquema de tabla pendiente de unificar
    }
  }, [isReviewRedirect, data?.review_url, data?.slug]);

  // Default theme settings
  const themeColor = data.theme_color || '#10B981';
  // The primary CTA (WhatsApp / guardar contacto) uses the profile owner's own theme_color so it
  // stays on-brand for them, but a dark/near-black theme_color makes it visually indistinguishable
  // from the zinc-900 secondary buttons around it. Fall back to the product's own brand emerald so
  // there is always exactly one clear primary action, regardless of the owner's color choice.
  const primaryCtaColor = getRelativeLuminance(themeColor) < 0.25 ? '#10B981' : themeColor;
  const isDark = data.is_dark_mode !== undefined ? data.is_dark_mode : true;
  const slug = data.slug || 'carlos';
  const websiteValue = data.website || data.website_url || '';
  const websiteHref = safeExternalUrl(websiteValue);
  const bankEmailValue = data.bank_email || data.contact_email || '';
  const profileContext = `${data.profession || ''} ${data.bio || ''} ${data.company || ''}`.toLowerCase();
  const hasWhatsapp = data.whatsapp_enabled !== false && !!data.whatsapp;
  const hasPhone = data.contact_phone_enabled !== false && !!data.contact_phone;
  const hasWebsite = data.website_enabled !== false && !!websiteValue;
  const hasCalendar = data.calendar_url_enabled !== false && !!data.calendar_url;
  const hasPortfolio = data.portfolio_enabled !== false && !!data.portfolio_url;
  const hasLocation = !!data.location;
  const explicitBusinessProfile = ['company', 'business'].includes(data.account_type);
  const inferredBusinessProfile = !!data.company && (hasWebsite || hasPhone || hasWhatsapp || hasLocation || /tienda|local|ventas|comercial|cat[aá]logo|restaurant|restaurante|barber|sal[oó]n|spa|inmobiliaria|distribuid|servicio t[eé]cnico/.test(profileContext));
  const isBusinessProfile = explicitBusinessProfile || inferredBusinessProfile;
  const showTopFallbackContact = !hasWhatsapp && !hasCalendar;
  const businessPrimaryLinkHref = hasWebsite ? websiteHref : (hasPortfolio ? safeExternalUrl(data.portfolio_url) : '');
  const businessPrimaryLinkLabel = hasWebsite ? 'Ver sitio web' : (hasPortfolio ? 'Ver catálogo' : '');
  const phoneCtaLabel = isBusinessProfile && hasLocation ? 'Llamar al local' : 'Llamar ahora';
  const whatsappCtaLabel = isBusinessProfile ? 'Escribir por WhatsApp' : (hasCalendar ? 'Escribirme por WhatsApp' : 'Hablemos por WhatsApp');
  const saveContactLabel = isBusinessProfile ? 'Guardar contacto comercial' : 'Guardar mi contacto';

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
    const textToCopy = `Datos de Transferencia:\nBanco: ${data.bank_name || ''}\nTipo: ${data.bank_type || ''}\nCuenta: ${data.bank_number || ''}\nRUT: ${data.bank_rut || ''}\nNombre: ${data.full_name || ''}\nEmail: ${bankEmailValue}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedField('all_bank');
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isReviewRedirect) {
    return (
      <div className="min-h-screen bg-zinc-950 grid place-items-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-bold text-sm">Redirigiendo a reseñas…</p>
        </div>
      </div>
    );
  }

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
          aria-label="Compartir perfil"
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
          <p className={`mt-1 text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
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
          {isBusinessProfile ? (
            <>
              {hasWhatsapp && (
                <a
                  href={`https://wa.me/${data.whatsapp}`}
                  onClick={() => handleLinkClick('whatsapp')}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-black/10 text-white"
                  style={{ backgroundColor: primaryCtaColor }}
                >
                  <Phone size={20} />
                  {whatsappCtaLabel}
                </a>
              )}
              {hasPhone && (
                <a
                  href={`tel:${data.contact_phone}`}
                  onClick={() => handleLinkClick('phone')}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
                >
                  <Phone size={20} />
                  {phoneCtaLabel}
                </a>
              )}
              {businessPrimaryLinkHref && (
                <a
                  href={businessPrimaryLinkHref}
                  onClick={() => handleLinkClick(hasWebsite ? 'website' : 'portfolio')}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
                >
                  <Globe size={20} />
                  {businessPrimaryLinkLabel}
                </a>
              )}
              {data.vcard_enabled !== false && (
                <button
                  onClick={handleSaveContact}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
                >
                  <UserPlus size={20} />
                  {saveContactLabel}
                </button>
              )}
            </>
          ) : (
            <>
              {data.vcard_enabled !== false && (
                <button
                  onClick={handleSaveContact}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-black/10"
                  style={{ backgroundColor: primaryCtaColor, color: '#fff' }}
                >
                  <UserPlus size={20} />
                  {saveContactLabel}
                </button>
              )}
              {hasWhatsapp && (
                <a
                  href={`https://wa.me/${data.whatsapp}`}
                  onClick={() => handleLinkClick('whatsapp')}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
                >
                  <Phone size={20} />
                  {whatsappCtaLabel}
                </a>
              )}
              {hasCalendar && (
                <a
                  href={safeExternalUrl(data.calendar_url)}
                  onClick={() => handleLinkClick('calendar')}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
                >
                  <Calendar size={20} />
                  Agendar reunión
                </a>
              )}
            </>
          )}
          {showTopFallbackContact && (
            <button
              onClick={() => setContactModal(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
            >
              💬 Conectemos
            </button>
          )}
        </div>

        {/* Modal Conectemos */}
        {contactModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setContactModal(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="connect-modal-heading"
              className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white'}`}
              onClick={e => e.stopPropagation()}
            >
              {contactSent ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="font-bold text-lg">¡Listo!</p>
                  <p className="text-sm opacity-60 mt-1">Te contactaremos pronto.</p>
                  <button onClick={() => { setContactModal(false); setContactSent(false); setContactError(''); }} className="mt-4 text-sm opacity-50 hover:opacity-80">Cerrar</button>
                </div>
              ) : (
                <>
                  <h3 id="connect-modal-heading" className="font-semibold text-lg mb-4">Conectemos</h3>
                  <div className="space-y-3">
                    <label htmlFor="connect-name" className="sr-only">Tu nombre</label>
                    <input id="connect-name" ref={firstFieldRef} type="text" placeholder="Tu nombre *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`} />
                    <label htmlFor="connect-contact" className="sr-only">Email o teléfono</label>
                    <input id="connect-contact" type="text" placeholder="Email o teléfono" value={contactForm.contact} onChange={e => setContactForm(p => ({ ...p, contact: e.target.value }))} className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400'}`} />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setContactModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold opacity-50 hover:opacity-80">Cancelar</button>
                    <button
                      disabled={contactLoading || !contactForm.name.trim()}
                      onClick={async () => {
                        if (!contactForm.name.trim()) return;
                        setContactLoading(true);
                        setContactError('');
                        try {
                          if (!supabase) throw new Error('no-supabase');
                          const contact = contactForm.contact.trim();
                          const isEmail = contact.includes('@');
                          // supabase-js resolves with { error } on RLS/insert failure instead of
                          // throwing — the previous code ignored that and always showed success,
                          // silently dropping leads (audit H6, 2026-08-25).
                          const { error } = await supabase.from('crm_contacts').insert({
                            name: contactForm.name,
                            email: isEmail ? contact : null,
                            phone: !isEmail && contact ? contact : null,
                            company: null,
                            source: 'nfc_tap',
                            profile_id: data.id || null,
                          });
                          if (error) throw error;
                          setContactSent(true);
                        } catch {
                          setContactError('No pudimos enviar tus datos. Intenta de nuevo o contáctanos directamente.');
                        } finally {
                          setContactLoading(false);
                        }
                      }}
                      className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                      style={{ backgroundColor: themeColor }}
                    >
                      {contactLoading ? 'Enviando…' : 'Enviar'}
                    </button>
                  </div>
                  {contactError && (
                    <p role="alert" className="mt-3 text-sm text-red-400">{contactError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6 pb-12">
        
        {!isBusinessProfile && (
        <>
        {/* Social Grid */}
        <div className="flex flex-wrap gap-3">
          {(data.whatsapp_enabled !== false && data.whatsapp) && (
            <a
              href={`https://wa.me/${data.whatsapp}`}
              onClick={() => handleLinkClick('whatsapp')}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
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
              aria-label="LinkedIn"
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
              aria-label="Instagram"
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
              aria-label="Facebook"
              className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
            >
              <Facebook size={24} className="text-blue-500" />
            </a>
          )}
        </div>
        </>
        )}

        {/* Contact Info Blocks */}
        <div className="space-y-3">
          {isBusinessProfile && hasLocation && (
            <div className={`flex items-center p-4 rounded-2xl shadow-sm border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 font-medium">Ubicación</p>
                <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.location}</p>
              </div>
            </div>
          )}

          {(data.contact_phone_enabled !== false && data.contact_phone) && (
            <a
              href={`tel:${data.contact_phone}`}
              onClick={() => handleLinkClick('phone')}
              className={`flex items-center p-4 rounded-2xl shadow-sm border transition-all group ${isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <Phone size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 font-medium">Teléfono</p>
                <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.contact_phone}</p>
              </div>
            </a>
          )}
          
          {(data.contact_email_enabled !== false && data.contact_email) && (
            <a
              href={`mailto:${data.contact_email}`}
              onClick={() => handleLinkClick('email')}
              className={`flex items-center p-4 rounded-2xl shadow-sm border transition-all group ${isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <Mail size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 font-medium">Correo Electrónico</p>
                <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{data.contact_email}</p>
              </div>
            </a>
          )}

          {/* Business profiles already show this same URL as the primary "Ver sitio web" CTA above;
              only repeat it here for individual profiles, which have no other website entry point. */}
          {!isBusinessProfile && (data.website_enabled !== false && websiteValue) && (
            <a
              href={websiteHref}
              onClick={() => handleLinkClick('website')}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center p-4 rounded-2xl shadow-sm border transition-all group ${isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-100 hover:border-zinc-300'}`}
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 mr-4">
                <Globe size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 font-medium">Sitio Web</p>
                <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{websiteValue.replace(/^https?:\/\//, '')}</p>
              </div>
            </a>
          )}
        </div>

        {/* Bank Details Accordion */}
        {data.bank_enabled !== false && (
          <div>
            <button
              onClick={() => setIsBankOpen(!isBankOpen)}
              aria-expanded={isBankOpen}
              aria-controls="bank-details-panel"
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
              <div id="bank-details-panel" className={`mt-2 p-5 rounded-2xl shadow-sm border space-y-3 animate-in slide-in-from-top-2 duration-300 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}>
                {[
                  { label: 'Banco', value: data.bank_name, field: 'bank_name' },
                  { label: 'Tipo', value: data.bank_type, field: 'bank_type' },
                  { label: 'Cuenta', value: data.bank_number, field: 'bank_number' },
                  { label: 'RUT', value: data.bank_rut, field: 'bank_rut' },
                  { label: 'Nombre', value: data.full_name, field: 'bank_full_name' },
                  { label: 'Email', value: bankEmailValue, field: 'bank_email' },
                ].filter(row => row.value).map(row => (
                  <div key={row.field} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex gap-2 min-w-0">
                      <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{row.label}:</span>
                      <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>{row.value}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(row.value, row.field)}
                      aria-label={`Copiar ${row.label}`}
                      className={`shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700'}`}
                    >
                      {copiedField === row.field ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
                <div className="pt-2">
                  <button
                    onClick={handleCopyAllBankData}
                    className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors text-sm"
                  >
                    {copiedField === 'all_bank' ? <Check size={18} /> : <Copy size={18} />}
                    {copiedField === 'all_bank' ? '¡Copiado!' : 'Copiar todos los datos'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Useful Links */}
        <div className="pt-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 px-2">Enlaces Útiles</h3>
          <div className="space-y-3">
            {/* Individual profiles already show the calendar link in the primary CTA zone above; only
                surface it here for business profiles, which have no other calendar entry point. */}
            {isBusinessProfile && (data.calendar_url_enabled !== false && data.calendar_url) && (
              <a
                href={safeExternalUrl(data.calendar_url)}
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
                href={safeExternalUrl(data.portfolio_url)}
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

        {isBusinessProfile && (
          <>
            <div className="flex flex-wrap gap-3">
              {(data.instagram_enabled !== false && data.instagram) && (
                <a
                  href={`https://instagram.com/${data.instagram}`}
                  onClick={() => handleLinkClick('instagram')}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
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
                  aria-label="Facebook"
                  className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
                >
                  <Facebook size={24} className="text-blue-500" />
                </a>
              )}
              {(data.linkedin_enabled !== false && data.linkedin) && (
                <a
                  href={data.linkedin.startsWith('http') ? data.linkedin : `https://linkedin.com/in/${data.linkedin}`}
                  onClick={() => handleLinkClick('linkedin')}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                  className={`flex items-center justify-center p-3 rounded-2xl shadow-sm border hover:scale-105 transition-transform ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'}`}
                >
                  <Linkedin size={24} className="text-blue-600" />
                </a>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setContactModal(true)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
              >
                💬 Conectemos
              </button>
            </div>
          </>
        )}

        {!isBusinessProfile && (
          <div className="pt-2">
            <button
              onClick={() => setContactModal(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 border ${isDark ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900 hover:bg-zinc-50'}`}
            >
              💬 Conectemos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NexCardProfile;
