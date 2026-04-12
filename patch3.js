const fs = require('fs');
const path = './nexcard-mvp/src/App.jsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const slug = path.replace(/^\\//, '');",
  "const slug = path.replace(/^\\/|\\/$/g, '');"
);

fs.writeFileSync(path, code);
