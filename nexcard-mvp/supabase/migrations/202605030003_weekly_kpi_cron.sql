-- Scheduled trigger: invocar send-weekly-kpi-report cada lunes 12:00 UTC
-- = 09:00 CLST (verano UTC-3) / 08:00 CLT (invierno UTC-4)
-- Requisito: pg_cron y pg_net habilitados (Dashboard → Database → Extensions)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('send-weekly-kpi-report');

    PERFORM cron.schedule(
      'send-weekly-kpi-report',
      '0 12 * * 1',
      $$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-weekly-kpi-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := '{"trigger":"cron"}'
      );
      $$
    );
  ELSE
    RAISE NOTICE 'pg_cron no disponible — invocar send-weekly-kpi-report manualmente o vía Vercel Cron Jobs';
  END IF;
END;
$$;
