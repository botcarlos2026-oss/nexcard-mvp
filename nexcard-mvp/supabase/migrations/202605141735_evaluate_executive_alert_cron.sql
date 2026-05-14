-- Intento de programación autónoma del evaluador cada 30 minutos.
-- Si pg_cron/pg_net no está disponible, queda sólo como NOTICE y se puede usar cron externo.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('evaluate-executive-alert');

    PERFORM cron.schedule(
      'evaluate-executive-alert',
      '*/30 * * * *',
      $cron$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/evaluate-executive-alert',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := '{"trigger":"cron"}'
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron no disponible — invocar evaluate-executive-alert desde cron externo o manualmente';
  END IF;
END;
$$;
