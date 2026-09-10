-- Schedule the validade-alert Edge Function via pg_cron
-- Runs daily at 08:00 Brasília (11:00 UTC) to send WhatsApp alerts
-- for etiqueta_registros that expire today and are still active.

DO $$
BEGIN
  PERFORM cron.unschedule('validade_alert_daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'validade_alert_daily',
  '0 11 * * *',
  $$
    SELECT net.http_post(
      url := 'https://qjxhqvphnqzjpfqzqgco.supabase.co/functions/v1/validade-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw'
      ),
      body := '{}'::jsonb
    );
  $$
);