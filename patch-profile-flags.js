const fs = require('fs');
const path = './nexcard-mvp/src/components/NexCardProfile.jsx';
let code = fs.readFileSync(path, 'utf8');

const replacements = [
  { old: 'data.whatsapp &&', new: '(data.whatsapp_enabled !== false && data.whatsapp) &&' },
  { old: 'data.linkedin &&', new: '(data.linkedin_enabled !== false && data.linkedin) &&' },
  { old: 'data.instagram &&', new: '(data.instagram_enabled !== false && data.instagram) &&' },
  { old: 'data.facebook &&', new: '(data.facebook_enabled !== false && data.facebook) &&' },
  { old: 'data.contact_phone &&', new: '(data.contact_phone_enabled !== false && data.contact_phone) &&' },
  { old: 'data.contact_email &&', new: '(data.contact_email_enabled !== false && data.contact_email) &&' },
  { old: 'data.website_url &&', new: '(data.website_enabled !== false && data.website_url) &&' },
  { old: 'data.calendar_url &&', new: '(data.calendar_url_enabled !== false && data.calendar_url) &&' },
  { old: 'data.portfolio_url &&', new: '(data.portfolio_enabled !== false && data.portfolio_url) &&' },
];

replacements.forEach(r => {
  code = code.split(r.old).join(r.new);
});

fs.writeFileSync(path, code);
