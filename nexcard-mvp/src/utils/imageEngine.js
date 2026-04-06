import { supabase } from '../services/supabaseClient';

/**
 * NexCard Sentinel - Image Processing Utility
 * MVP local/API bridge. En producción usará storage real.
 */

export const uploadAvatar = async (userId, file) => {
  console.log(`[SENTINEL STORAGE] Subiendo imagen para usuario: ${userId}`);
  const ext = file.name.split('.').pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
  return urlData.publicUrl;
};

export const imageUrlToBase64 = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error convirtiendo imagen a Base64:', error);
    return null;
  }
};
