const KPI_RUNTIME_CONFIG_META = {
  sla_targets: {
    allowedKeys: ['paid_to_ready', 'ready_to_shipped', 'shipped_to_delivered', 'delivered_to_activated'],
    min: 1,
    max: 720,
  },
  payment_method_fees: {
    allowedKeys: ['webpay', 'transbank', 'mercado_pago', 'mercado-pago', 'default'],
    min: 0,
    max: 0.25,
  },
  wow_alert_thresholds: {
    allowedKeys: ['revenue_drop_pct', 'payment_rate_drop_pts', 'carrier_delivery_rate_drop_pts', 'sku_claim_rate_pct'],
    min: -100,
    max: 100,
  },
  executive_alert_policy: {
    allowedKeys: ['enabled', 'cooldown_minutes', 'dedupe_by_band', 'min_band_watch', 'min_band_critical'],
    min: 0,
    max: 1440,
  },
  executive_alert_routing: {
    allowedKeys: ['enabled', 'auto_dispatch', 'dry_run_default', 'recipients_csv'],
  },
  executive_alert_band_policy: {
    allowedKeys: ['kill_switch', 'watch_cooldown_minutes', 'critical_cooldown_minutes', 'watch_recipients_csv', 'critical_recipients_csv'],
  },
};

export const validateKpiRuntimeConfig = (key, config) => {
  const meta = KPI_RUNTIME_CONFIG_META[key];
  if (!meta) throw new Error(`Key KPI no soportada: ${key}`);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`La config ${key} debe ser un objeto JSON.`);

  const unknownKeys = Object.keys(config).filter((entry) => !meta.allowedKeys.includes(entry));
  if (unknownKeys.length > 0) throw new Error(`Campos no permitidos en ${key}: ${unknownKeys.join(', ')}`);

  if (key === 'executive_alert_routing' || key === 'executive_alert_band_policy') {
    if (key === 'executive_alert_band_policy') {
      const killSwitch = config.kill_switch;
      if (killSwitch != null && ![0, 1].includes(Number(killSwitch))) throw new Error(`El campo kill_switch en ${key} debe ser 0 o 1.`);
      ['watch_cooldown_minutes', 'critical_cooldown_minutes'].forEach((entry) => {
        const value = config[entry];
        if (value == null) return;
        if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1440) throw new Error(`El campo ${entry} en ${key} debe ser numérico entre 0 y 1440.`);
      });
      ['watch_recipients_csv', 'critical_recipients_csv'].forEach((entry) => {
        const value = config[entry];
        if (value == null) return;
        if (typeof value !== 'string') throw new Error(`El campo ${entry} en ${key} debe ser texto.`);
      });
      return true;
    }
    ['enabled', 'auto_dispatch', 'dry_run_default'].forEach((entry) => {
      const value = config[entry];
      if (value == null) return;
      if (![0, 1].includes(Number(value))) throw new Error(`El campo ${entry} en ${key} debe ser 0 o 1.`);
    });
    if (config.recipients_csv != null && typeof config.recipients_csv !== 'string') {
      throw new Error(`El campo recipients_csv en ${key} debe ser texto.`);
    }
    return true;
  }

  for (const [entry, value] of Object.entries(config)) {
    if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`El campo ${entry} en ${key} debe ser numérico.`);
    if (value < meta.min || value > meta.max) throw new Error(`El campo ${entry} en ${key} quedó fuera de rango (${meta.min} a ${meta.max}).`);
  }

  return true;
};

export function createKpiAdminApi({ supabase, hasSupabase, getClerkUserId, getCurrentUserEmail }) {
  return {
    getKpiRuntimeConfig: async () => {
      if (!hasSupabase) return { configs: [] };
      const { data, error } = await supabase
        .from('kpi_runtime_config')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { configs: data || [] };
    },

    getKpiRuntimeConfigAudit: async () => {
      if (!hasSupabase) return { entries: [] };
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, entity_id, action, before, after, context, created_at')
        .eq('entity_type', 'kpi_runtime_config')
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw new Error(error.message);
      return { entries: data || [] };
    },

    getKpiAlertState: async () => {
      if (!hasSupabase) return { entries: [] };
      const { data, error } = await supabase
        .from('kpi_alert_state')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { entries: data || [] };
    },

    getKpiAlertHistory: async () => {
      if (!hasSupabase) return { entries: [] };
      const { data, error } = await supabase
        .from('kpi_alert_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return { entries: data || [] };
    },

    getKpiAlertEvaluations: async () => {
      if (!hasSupabase) return { entries: [] };
      const { data, error } = await supabase
        .from('kpi_alert_evaluations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return { entries: data || [] };
    },

    evaluateExecutiveAlert: async (trigger = 'manual') => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { data, error } = await supabase.functions.invoke('evaluate-executive-alert', {
        body: JSON.stringify({ trigger }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (error) throw new Error(error.message || 'No pude evaluar alerta ejecutiva');
      if (data?.error) throw new Error(data.error);
      return data;
    },

    dispatchExecutiveAlert: async ({ payload, dryRun = true, recipients = [] }) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      const { data, error } = await supabase.functions.invoke('send-executive-alert', {
        body: JSON.stringify({ alert_key: 'executive_score', payload, dry_run: dryRun, recipients }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (error) throw new Error(error.message || 'No pude disparar la alerta ejecutiva');
      if (data?.error) throw new Error(data.error);
      return data;
    },

    upsertKpiAlertState: async ({ alert_key, last_band, last_score, last_payload, cooldown_minutes }) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      if (!alert_key) throw new Error('alert_key requerido');
      const payload = {
        alert_key,
        last_band: last_band || null,
        last_score: last_score ?? null,
        last_payload: last_payload || {},
        cooldown_minutes: cooldown_minutes ?? null,
        last_sent_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('kpi_alert_state')
        .upsert(payload, { onConflict: 'alert_key' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    upsertKpiRuntimeConfig: async ({ key, config, active = true }) => {
      if (!hasSupabase) throw new Error('Supabase no configurado');
      if (!key) throw new Error('Key requerida');
      validateKpiRuntimeConfig(key, config || {});
      const actorUserId = getClerkUserId();
      const actorEmail = getCurrentUserEmail();
      const { data: previousRow } = await supabase
        .from('kpi_runtime_config')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      const { data, error } = await supabase
        .from('kpi_runtime_config')
        .upsert({ key, config: config || {}, active }, { onConflict: 'key' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await supabase.from('audit_log').insert({
        actor_user_id: actorUserId,
        actor_role: 'admin',
        entity_type: 'kpi_runtime_config',
        entity_id: data.id,
        action: previousRow ? 'update' : 'create',
        before: previousRow ? { key: previousRow.key, config: previousRow.config, active: previousRow.active } : null,
        after: { key: data.key, config: data.config, active: data.active },
        context: {
          key,
          actor_email: actorEmail,
          source: 'admin_dashboard',
        },
      });
      return data;
    },
  };
}
