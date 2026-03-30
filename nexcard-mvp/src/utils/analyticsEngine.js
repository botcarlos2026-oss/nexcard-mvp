/**
 * NexCard Sentinel - Analytics Engine
 * MVP local/API bridge. En producción enviará eventos a backend real.
 */

import { api } from '../services/api';

export const trackClick = async (slug, buttonType) => {
  try {
    await api.trackClick({ slug, buttonType });
  } catch (error) {
    console.error('[SENTINEL ANALYTICS] Error enviando evento:', error);
  }

  const statsKey = `nexcard_stats_${slug}`;
  const currentStats = JSON.parse(localStorage.getItem(statsKey) || '{"whatsapp":0, "vcard":0, "instagram":0, "calendar":0}');

  if (currentStats[buttonType] !== undefined) {
    currentStats[buttonType] += 1;
    localStorage.setItem(statsKey, JSON.stringify(currentStats));
  }
};
