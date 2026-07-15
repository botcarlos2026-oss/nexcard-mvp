import { slugify } from '../../utils/slug';

const normalizeAccountType = (value) => {
  if (value === 'business' || value === 'company') return 'company';
  return 'individual';
};

const PROFILE_ALLOWED_FIELDS = [
  'slug', 'full_name', 'profession', 'bio', 'avatar_url', 'theme_color', 'is_dark_mode',
  'whatsapp', 'instagram', 'linkedin', 'website', 'vcard_enabled', 'calendar_url',
  'bank_enabled', 'bank_name', 'bank_type', 'bank_number', 'bank_rut', 'bank_email',
  'view_count', 'status', 'account_type', 'company', 'contact_email', 'contact_phone',
  'location', 'cover_image_url', 'facebook', 'facebook_enabled', 'instagram_enabled',
  'linkedin_enabled', 'contact_email_enabled', 'contact_phone_enabled', 'website_enabled',
  'whatsapp_enabled', 'portfolio_enabled', 'portfolio_url', 'calendar_url_enabled',
  'tiktok', 'tiktok_enabled', 'review_url', 'card_type'
];

const buildProfilePayload = (payload = {}, { userId, email, existingProfile } = {}) => {
  const baseSlug = slugify(payload.slug || payload.full_name || email?.split('@')[0] || 'perfil');
  const normalizedPayload = {
    ...payload,
    website: payload.website || payload.website_url || existingProfile?.website || existingProfile?.website_url || null,
    user_id: userId,
    slug: baseSlug || `perfil-${Date.now()}`,
    full_name: payload.full_name?.trim() || existingProfile?.full_name || email?.split('@')[0] || 'Nuevo perfil NexCard',
    account_type: normalizeAccountType(payload.account_type || existingProfile?.account_type),
    contact_email: payload.contact_email || existingProfile?.contact_email || email || null,
    status: payload.status || existingProfile?.status || 'active',
    theme_color: payload.theme_color || existingProfile?.theme_color || '#10B981',
  };

  return Object.fromEntries(
    Object.entries(normalizedPayload).filter(([key, value]) => {
      if (key === 'user_id') return true;
      return PROFILE_ALLOWED_FIELDS.includes(key) && value !== undefined;
    })
  );
};

export function createProfilesApi({ supabase, hasSupabase, getClerkUserId, getCurrentUserEmail, request }) {
  const fetchAdminProfiles = async () => {
    const [profilesRes, versionsRes, eventsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('profile_versions')
        .select('profile_id, version')
        .order('version', { ascending: false }),
      supabase
        .from('audit_log')
        .select('entity_id, action, created_at')
        .eq('entity_type', 'profile')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const versions = versionsRes.data || [];
    const events = eventsRes.data || [];

    const latestVersionMap = versions.reduce((acc, v) => {
      if (!acc[v.profile_id] || v.version > acc[v.profile_id]) {
        acc[v.profile_id] = v.version;
      }
      return acc;
    }, {});

    const lastEventMap = events.reduce((acc, e) => {
      if (!acc[e.entity_id]) acc[e.entity_id] = e;
      return acc;
    }, {});

    const profiles = (profilesRes.data || []).map((p) => ({
      ...p,
      latest_version: latestVersionMap[p.id] || null,
      last_event: lastEventMap[p.id] || null,
    }));

    return { profiles };
  };

  const previewProfileClaim = async (token) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.functions.invoke('claim-profile', {
      body: JSON.stringify({ action: 'preview', token }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (error) throw new Error(error.message || 'No fue posible validar tu activación');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const claimProfile = async (token) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.functions.invoke('claim-profile', {
      body: JSON.stringify({ action: 'claim', token }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (error) throw new Error(error.message || 'No fue posible activar tu perfil');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const getPublicProfile = async (slug) => {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('profiles').select('*')
        .eq('slug', slug).eq('status', 'active').is('deleted_at', null).single();
      if (!error && data) return data;
    }
    return request(`/public/profiles/${slug}`);
  };

  const getMyProfile = async () => {
    if (!hasSupabase) throw new Error('Perfil privado deshabilitado');
    const userId = getClerkUserId();
    if (!userId) throw new Error('No hay sesión activa');
    const { data, error } = await supabase
      .from('profiles').select('*').eq('user_id', userId).is('deleted_at', null).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

  const checkProfileSlugAvailability = async (slug, orderId = null) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase.rpc('check_profile_slug_availability', {
      candidate_slug: slug,
      current_order_id: orderId,
    });
    if (error) throw new Error(error.message || 'No fue posible validar el usuario');
    return data;
  };

  const updateMyProfile = async (payload) => {
    if (!hasSupabase) throw new Error('Edición deshabilitada');
    const userId = getClerkUserId();
    if (!userId) throw new Error('No hay sesión activa');

    const { data: existingProfile, error: existingError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    const profilePayload = buildProfilePayload(payload, {
      userId,
      email: getCurrentUserEmail(),
      existingProfile,
    });

    if (existingProfile?.slug !== profilePayload.slug) {
      const availability = await checkProfileSlugAvailability(profilePayload.slug);
      if (!availability.available && availability.reason !== 'reserved') {
        throw new Error(availability.message || 'Ese usuario no está disponible.');
      }
    }

    if (!existingProfile) {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profilePayload)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('id', existingProfile.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  };

  const getProfileSlugForOrder = async (orderId, customerEmail) => {
    if (!hasSupabase) return null;

    const { data: linkedCard } = await supabase
      .from('cards')
      .select('profile_id')
      .eq('order_id', orderId)
      .not('profile_id', 'is', null)
      .limit(1)
      .maybeSingle();

    if (linkedCard?.profile_id) {
      const { data: byCard } = await supabase
        .from('profiles')
        .select('slug')
        .eq('id', linkedCard.profile_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (byCard?.slug) return byCard.slug;
    }

    if (!customerEmail) return null;
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('slug, id')
      .ilike('contact_email', customerEmail.trim())
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    return byEmail?.slug || null;
  };

  const getAdminProfiles = async () => {
    if (!hasSupabase) return { profiles: [] };
    return fetchAdminProfiles();
  };

  const archiveProfile = async (profileId) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('soft_delete_profile', {
      target_profile_id: profileId,
      actor_id: actorId,
    });
    if (error) throw new Error(error.message);
    return fetchAdminProfiles();
  };

  const restoreProfileVersion = async (profileId, version) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const actorId = getClerkUserId();
    const { error } = await supabase.rpc('restore_profile_version', {
      target_profile_id: profileId,
      target_version: version,
      actor_id: actorId,
    });
    if (error) throw new Error(error.message);
    return fetchAdminProfiles();
  };

  const getCardScans = async (profileSlug) => {
    const { data } = await supabase.from('card_scans').select('*').eq('profile_slug', profileSlug).order('scanned_at', { ascending: false });
    return { scans: data || [] };
  };

  return {
    previewProfileClaim,
    claimProfile,
    getPublicProfile,
    getMyProfile,
    updateMyProfile,
    checkProfileSlugAvailability,
    getProfileSlugForOrder,
    getAdminProfiles,
    archiveProfile,
    restoreProfileVersion,
    getCardScans,
  };
}
