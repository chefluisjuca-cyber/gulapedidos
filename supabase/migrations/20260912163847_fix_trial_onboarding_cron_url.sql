-- Fix trial-onboarding cron: the previous migration had the WRONG project URL
-- (qjxhqvphnqzjpfqzqgco.supabase.co instead of sslcpewhqsznhikqbrua.supabase.co).
-- With the wrong URL, the cron's HTTP POST never reached the edge function,
-- so onboarding messages 2 (day 3) and 3 (day 6) were never sent.

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
      url := 'https://sslcpewhqsznhikqbrua.supabase.co/functions/v1/trial-onboarding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzbGNwZXdocXN6bmhpa3FicnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzA3MTIsImV4cCI6MjA5NzMwNjcxMn0.nrzhyssHnw3-_I2Tyt9oYExofhFxwUGotGBPID2bbBw'
      ),
      body := '{}'::jsonb
    );
  $$
);