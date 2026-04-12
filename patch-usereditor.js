const fs = require('fs');
const path = './nexcard-mvp/src/components/UserEditor.jsx';
let code = fs.readFileSync(path, 'utf8');

const oldLinksBlock = `          {activeTab === 'links' && (
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
          )}`;

const newLinksBlock = `          {activeTab === 'links' && (
            <div className="space-y-6">
              {[
                ['whatsapp', 'WhatsApp (con código de país)', 'Ej: 56912345678', 'whatsapp_enabled'],
                ['instagram', 'Instagram (Usuario)', '@usuario', 'instagram_enabled'],
                ['linkedin', 'LinkedIn', 'perfil-linkedin', 'linkedin_enabled'],
                ['facebook', 'Facebook', 'perfil-facebook', 'facebook_enabled'],
                ['contact_phone', 'Teléfono Múltiple', '+56 9...', 'contact_phone_enabled'],
                ['contact_email', 'Correo Electrónico', 'correo@empresa.com', 'contact_email_enabled'],
                ['website_url', 'Sitio Web', 'https://...', 'website_enabled'],
                ['portfolio_url', 'URL Portafolio', 'https://...', 'portfolio_enabled'],
                ['calendar_url', 'URL Agenda', 'https://calendly.com/...', 'calendar_url_enabled'],
              ].map(([field, label, placeholder, toggleField]) => {
                const isEnabled = profile[toggleField] !== false;
                return (
                  <div key={field} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</span>
                      <button 
                        onClick={() => handleChange(toggleField, !isEnabled)} 
                        className={\`w-10 h-5 rounded-full transition-colors relative \${isEnabled ? 'bg-emerald-500' : 'bg-zinc-300'}\`}
                      >
                        <div className={\`absolute top-1 w-3 h-3 bg-white rounded-full transition-all \${isEnabled ? 'left-6' : 'left-1'}\`}></div>
                      </button>
                    </div>
                    {isEnabled && (
                      <input 
                        type="text" 
                        placeholder={placeholder} 
                        value={profile[field] || ''} 
                        onChange={(e) => handleChange(field, e.target.value)} 
                        className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all" 
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}`;

code = code.replace(oldLinksBlock, newLinksBlock);

const basicBlockIndex = code.indexOf(`{activeTab === 'basic' && (`);
const oldBasicBlockPart = `<label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Bio Corta</span>
                  <textarea value={profile.bio || ''} onChange={(e) => handleChange('bio', e.target.value)} rows="3" className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none"></textarea>
                </label>`;
const newBasicBlockPart = `<label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Empresa</span>
                  <input type="text" value={profile.company || ''} onChange={(e) => handleChange('company', e.target.value)} className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Ubicación</span>
                  <input type="text" value={profile.location || ''} onChange={(e) => handleChange('location', e.target.value)} className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Bio Corta</span>
                  <textarea value={profile.bio || ''} onChange={(e) => handleChange('bio', e.target.value)} rows="3" className="mt-2 w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/10 transition-all resize-none"></textarea>
                </label>
                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100 mt-4">
                  <div>
                    <p className="font-bold text-sm text-zinc-950">Habilitar "Guardar Contacto" (vCard)</p>
                  </div>
                  <button onClick={() => handleChange('vcard_enabled', profile.vcard_enabled !== false ? false : true)} className={\`w-12 h-6 rounded-full transition-colors relative \${profile.vcard_enabled !== false ? 'bg-emerald-500' : 'bg-zinc-300'}\`}>
                    <div className={\`absolute top-1 w-4 h-4 bg-white rounded-full transition-all \${profile.vcard_enabled !== false ? 'left-7' : 'left-1'}\`}></div>
                  </button>
                </div>`;

code = code.replace(oldBasicBlockPart, newBasicBlockPart);

fs.writeFileSync(path, code);
