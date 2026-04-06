/**
 * NexCard Sentinel - Analytics Engine
 * MVP local/API bridge. En producción enviará eventos a backend real.
 */

import { supabase } from '../services/supabaseClient';

export const trackClick = async (slug, buttonType) => {
  try {
    await supabase.from('events').insert({
      profile_slug: slug,
      event_type: buttonType,
      metadata: { device: /Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop' },
    });
  } catch (error) {
    console.error('[SENTINEL ANALYTICS] Error enviando evento:', error);
  }
};
