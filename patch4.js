const fs = require('fs');
const path = './nexcard-mvp/src/services/api.js';
let code = fs.readFileSync(path, 'utf8');

// The error is: _supabaseClient__WEBPACK_IMPORTED_MODULE_0__.supabase.rpc(...).catch is not a function
// This happens because supabase.rpc() returns a PostgrestBuilder, which is thenable but doesn't have a .catch() method directly like a standard Promise unless you await it or call .then() on it first.

code = code.replace(
  /supabase\.rpc\('increment_view_count', \{ profile_slug: slug \}\)\.catch\(\(\) => \{\}\);/,
  `supabase.rpc('increment_view_count', { profile_slug: slug }).then(() => {}).catch(() => {});`
);

fs.writeFileSync(path, code);
