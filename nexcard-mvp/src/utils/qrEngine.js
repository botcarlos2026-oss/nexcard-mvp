import QRCode from 'qrcode';

/**
 * NexCard Sentinel - QR Engine
 * Genera códigos QR de alta resolución optimizados para impresión física (PVC).
 */

export const generateQRCode = async (slug, options = {}) => {
  const url = `${window.location.origin}/${slug}`;
  const qrOptions = {
    errorCorrectionLevel: 'H', // Alta corrección para que funcione aunque la tarjeta se raye
    type: 'image/png',
    quality: 1,
    margin: 1,
    color: {
      dark: options.color || '#000000',
      light: '#FFFFFF',
    },
    width: 1024, // Alta resolución para imprenta
    ...options
  };

  try {
    const dataUrl = await QRCode.toDataURL(url, qrOptions);
    
    // Crear enlace de descarga automática
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_NexCard_${slug}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return dataUrl;
  } catch (err) {
    console.error('Error generando QR:', err);
    return null;
  }
};
