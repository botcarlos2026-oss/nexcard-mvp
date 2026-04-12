const fs = require('fs');
const path = './nexcard-mvp/src/components/UserEditor.jsx';
let code = fs.readFileSync(path, 'utf8');

// Import uploadCover
code = code.replace(
  "import { uploadAvatar } from '../utils/imageEngine';",
  "import { uploadAvatar, uploadCover } from '../utils/imageEngine';"
);

// Add state for uploading cover
code = code.replace(
  "const [uploading, setUploading] = useState(false);",
  "const [uploading, setUploading] = useState(false);\n  const [uploadingCover, setUploadingCover] = useState(false);"
);

// Add handleCoverChange function
const handleCoverCode = `
  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error('No hay sesión activa');
      const newUrl = await uploadCover(userId, file);
      handleChange('cover_image_url', newUrl);
    } catch (error) {
      console.error('Error subiendo portada:', error);
    } finally {
      setUploadingCover(false);
    }
  };
`;
code = code.replace(
  "const handleImageChange = async (e) => {",
  handleCoverCode + "\n  const handleImageChange = async (e) => {"
);

// Add Cover Upload UI to the "Diseño" tab
const designTabOld = `          {activeTab === 'design' && (
            <div className="space-y-8">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Color de Marca</span>`;

const designTabNew = `          {activeTab === 'design' && (
            <div className="space-y-8">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Foto de Portada</p>
                <div className="relative w-full h-32 rounded-xl bg-zinc-200 overflow-hidden border border-zinc-300 flex items-center justify-center">
                  {profile.cover_image_url ? (
                    <img src={profile.cover_image_url} alt="Portada" className={\`w-full h-full object-cover \${uploadingCover ? 'opacity-50' : ''}\`} />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: profile.theme_color || '#10B981' }}></div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-all cursor-pointer group">
                    <div className="px-4 py-2 bg-white/90 rounded-full shadow-sm text-sm font-bold text-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <ImageIcon size={16} />
                      Cambiar Portada
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                  </label>
                  {uploadingCover && <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm"><Loader2 className="animate-spin text-emerald-500" /></div>}
                </div>
                <button onClick={() => handleChange('cover_image_url', null)} className="mt-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
                  Eliminar portada (Usará color de marca)
                </button>
              </div>

              <div>
                <span className="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1">Color de Marca</span>`;

code = code.replace(designTabOld, designTabNew);
fs.writeFileSync(path, code);
