const fs = require('fs');
const path = './nexcard-mvp/src/utils/imageEngine.js';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('uploadCover')) {
  code = code.replace(
    'export const uploadAvatar',
    `export const uploadCover = async (userId, file) => {
  console.log(\`[SENTINEL STORAGE] Subiendo portada para usuario: \${userId}\`);
  const ext = file.name.split('.').pop();
  const path = \`\${userId}/cover-\${Date.now()}.\${ext}\`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
  return urlData.publicUrl;
};

export const uploadAvatar`
  );
  fs.writeFileSync(path, code);
}
