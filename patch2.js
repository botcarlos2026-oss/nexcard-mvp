const fs = require('fs');
const path = './nexcard-mvp/src/services/api.js';
let code = fs.readFileSync(path, 'utf8');

// The code catches the error from supabasePublicProfile and throws it if it fails.
// We should check if it's falling back to request() and throwing "Failed to fetch".
// Let's modify the try-catch in getPublicProfile to throw the actual error if Supabase is active,
// instead of hiding it and falling back to a local fetch that fails.

code = code.replace(
  /getPublicProfile: async \(slug\) => \{[\s\S]*?return request\(\`\/public\/profiles\/\$\{slug\}\`\);\n  \},/,
  `getPublicProfile: async (slug) => {
    if (hasSupabase) {
      const profile = await supabasePublicProfile(slug);
      if (profile) return profile;
      throw new Error('Perfil no encontrado en Supabase');
    }
    return request(\`/public/profiles/\${slug}\`);
  },`
);

fs.writeFileSync(path, code);
