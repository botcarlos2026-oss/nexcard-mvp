import { api } from '../services/api';

/**
 * NexCard Sentinel - Image Processing Utility
 * MVP local/API bridge. En producción usará storage real.
 */

export const uploadAvatar = async (userId, file) => {
  console.log(`[SENTINEL STORAGE] Subiendo imagen para usuario: ${userId}`);
  const localPreview = URL.createObjectURL(file);

  try {
    const response = await api.uploadAvatar(localPreview);
    return response.url || localPreview;
  } catch (error) {
    console.error('Error subiendo avatar al API local:', error);
    return localPreview;
  }
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
