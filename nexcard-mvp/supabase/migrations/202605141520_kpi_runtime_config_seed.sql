insert into public.kpi_runtime_config (key, config, active)
values
  (
    'sla_targets',
    '{"paid_to_ready":24,"ready_to_shipped":24,"shipped_to_delivered":72,"delivered_to_activated":24}'::jsonb,
    true
  ),
  (
    'payment_method_fees',
    '{"webpay":0.0295,"transbank":0.0295,"mercado_pago":0.0349,"mercado-pago":0.0349,"default":0}'::jsonb,
    true
  ),
  (
    'wow_alert_thresholds',
    '{"revenue_drop_pct":-20,"payment_rate_drop_pts":-8,"carrier_delivery_rate_drop_pts":-10,"sku_claim_rate_pct":8}'::jsonb,
    true
  )
on conflict (key) do update
set config = excluded.config,
    active = excluded.active,
    updated_at = now();
