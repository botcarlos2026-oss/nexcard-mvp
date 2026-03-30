import React, { useState } from 'react';
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
  ExternalLink 
} from 'lucide-react';
import { generateVCard } from '../utils/vCardEngine';
import { trackClick } from '../utils/analyticsEngine';

const NexCardProfile = ({ data }) => {
  const [copiedField, setCopiedField] = useState(null);
  const [isBankOpen, setIsBankOpen] = useState(false);

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

  return (
    <div className={`min-h-screen font-sans ${isDark ? 'bg-zinc-950 text-white' : 'bg-gray-50 text-zinc-900'}`}>
      
      {/* Header / Avatar Section */}
      <div className="max-w-md mx-auto px-6 pt-12 pb-8 text-center">
        <div className="relative inline-block group">
          <div 
            className="absolute inset-0 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"
            style={{ backgroundColor: themeColor }}
          ></div>
          <img 
            src={data.avatar_url || 'https://via.placeholder.com/150'} 
            alt={data.full_name}
            className="w-32 h-32 rounded-full border-4 object-cover relative z-10"
            style={{ borderColor: themeColor }}
          />
        </div>
        
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{data.full_name}</h1>
        <p className="mt-1 text-lg opacity-60 font-medium">{data.profession}</p>
        <p className="mt-4 text-sm opacity-80 leading-relaxed px-4">{data.bio}</p>

        {/* Action Buttons (Primary) */}
        <div className="mt-8 flex gap-3 justify-center">
          {data.vcard_enabled && (
            <button 
              onClick={handleSaveContact}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-black/20"
              style={{ backgroundColor: themeColor, color: '#fff' }}
            >
              <UserPlus size={20} />
              Guardar Contacto
            </button>
          )}
          <button 
            onClick={handleShare}
            className="p-4 rounded-2xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-zinc-700/50"
          >
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* Social & Contact Links */}
      <div className="max-w-md mx-auto px-6 space-y-3 pb-12">
        
        {data.whatsapp && (
          <a 
            href={`https://wa.me/${data.whatsapp}`}
            onClick={() => handleLinkClick('whatsapp')}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700 transition-all"
          >
            <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
              <Phone size={22} />
            </div>
            <span className="flex-1 font-semibold">WhatsApp</span>
            <ExternalLink size={16} className="opacity-30" />
          </a>
        )}

        {data.calendar_url && (
          <a 
            href={data.calendar_url}
            onClick={() => handleLinkClick('calendar')}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700 transition-all"
          >
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Calendar size={22} />
            </div>
            <span className="flex-1 font-semibold">Agendar Cita</span>
            <ExternalLink size={16} className="opacity-30" />
          </a>
        )}

        {data.instagram && (
          <a 
            href={`https://instagram.com/${data.instagram}`}
            onClick={() => handleLinkClick('instagram')}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700 transition-all"
          >
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500">
              <Instagram size={22} />
            </div>
            <span className="flex-1 font-semibold">Instagram</span>
            <ExternalLink size={16} className="opacity-30" />
          </a>
        )}

        {/* Bank Details Accordion */}
        {data.bank_enabled && (
          <div className="mt-6">
            <button 
              onClick={() => setIsBankOpen(!isBankOpen)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-800/30 border border-zinc-700/30 hover:bg-zinc-800/50 transition-all"
            >
              <span className="font-bold flex items-center gap-2 text-zinc-400">
                <Globe size={18} />
                Datos para transferencia
              </span>
              <ChevronDown 
                size={20} 
                className={`transition-transform duration-300 ${isBankOpen ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {isBankOpen && (
              <div className="mt-2 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center group">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Banco</p>
                    <p className="font-medium">{data.bank_name}</p>
                  </div>
                  <button onClick={() => handleCopy(data.bank_name, 'bank')} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-800 rounded-lg transition-all">
                    {copiedField === 'bank' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
                
                <div className="flex justify-between items-center group border-t border-zinc-800 pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Cuenta</p>
                    <p className="font-medium">{data.bank_type} - {data.bank_number}</p>
                  </div>
                  <button onClick={() => handleCopy(data.bank_number, 'account')} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-800 rounded-lg transition-all">
                    {copiedField === 'account' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="flex justify-between items-center group border-t border-zinc-800 pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">RUT / Identificador</p>
                    <p className="font-medium">{data.bank_rut}</p>
                  </div>
                  <button onClick={() => handleCopy(data.bank_rut, 'rut')} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-zinc-800 rounded-lg transition-all">
                    {copiedField === 'rut' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
