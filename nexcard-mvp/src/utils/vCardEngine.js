import { trackClick } from '../utils/analyticsEngine';
import { imageUrlToBase64 } from '../utils/imageEngine';

export const generateVCard = async (data) => {
  let photoSection = '';
  
  if (data.avatar_url && !data.avatar_url.includes('placeholder')) {
    const base64Photo = await imageUrlToBase64(data.avatar_url);
    if (base64Photo) {
      photoSection = `PHOTO;ENCODING=b;TYPE=JPEG:${base64Photo}`;
    }
  }

  const vCardLines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${data.full_name}`,
    `N:;${data.full_name};;;`,
    `ORG:${data.profession}`,
    photoSection,
    `TEL;TYPE=CELL,VOICE:${data.whatsapp}`,
    `EMAIL;TYPE=PREF,INTERNET:${data.bank_email || ''}`,
    `URL:${window.location.origin}/${data.slug || ''}`,
    `X-SOCIALMSGR;TYPE=instagram:${data.instagram || ''}`,
    `X-SOCIALMSGR;TYPE=linkedin:${data.linkedin || ''}`,
    'REV:' + new Date().toISOString(),
    'END:VCARD'
  ].filter(line => {
    if (!line) return false;
    const val = line.split(':').slice(1).join(':').trim();
    return val && val !== 'null' && val !== 'undefined';
  });

  const vCardString = vCardLines.join('\n');
  const blob = new Blob([vCardString], { type: 'text/vcard;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${data.full_name.replace(/\s+/g, '_')}_NexCard.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
