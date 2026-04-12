const fs = require('fs');
const path = './nexcard-mvp/src/components/NexCardProfile.jsx';
let code = fs.readFileSync(path, 'utf8');

const oldHeader = `      {/* Header Banner */}
      <div className="relative h-32 w-full bg-gradient-to-r from-pink-500 via-purple-300 to-blue-400">
        <button `;

const newHeader = `      {/* Header Banner */}
      <div 
        className="relative h-32 w-full bg-cover bg-center"
        style={{ 
          backgroundImage: data.cover_image_url ? \`url(\${data.cover_image_url})\` : 'none',
          backgroundColor: data.cover_image_url ? 'transparent' : themeColor
        }}
      >
        {!data.cover_image_url && (
           <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-black/0 via-black/10 to-black/30"></div>
        )}
        <button `;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync(path, code);
