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
};
