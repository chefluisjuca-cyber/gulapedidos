-- Fix trial-onboarding cron: the original migration used
-- current_setting('app.supabase_anon_key', true) to pass the anon key
-- in the Authorization/apikey headers, but that GUC was never set.
-- Without a valid key, the edge function rejects the request, so
-- onboarding messages 2 and 3 never send.
--
-- Fix: embed the anon key directly in the cron job command.

DO $$
BEGIN
  PERFORM cron.unschedule('trial_onboarding_daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'trial_onboarding_daily',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := 'https://qjxhqvphnqzjpfqzqgco.supabase.co/functions/v1/trial-onboarding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw'
      ),
      body := '{}'::jsonb
    );
  $$
);