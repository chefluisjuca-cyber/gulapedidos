/*
# Schedule trial-onboarding Edge Function via pg_cron

1. Purpose
   This migration configures the pg_cron + pg_net extensions to invoke
   the "trial-onboarding" Edge Function automatically every day at 09:00
   (horário de Brasília, UTC-3). The Edge Function sends WhatsApp
   onboarding messages to restaurants in their 7-day free trial period.

2. Extensions
   - pg_cron: PostgreSQL-based cron scheduler.
   - pg_net: HTTP client for making outbound requests from Postgres.
   Both are created IF NOT EXISTS so the migration is idempotent.

3. Scheduled Job
   - Job name: trial_onboarding_daily
   - Schedule: 0 12 * * * (every day at 12:00 UTC = 09:00 Brasília)
   - Action: HTTP POST to the trial-onboarding Edge Function endpoint
     using pg_net.http_post, passing the anon key in the Authorization
     and apikey headers.

4. Idempotency
   - The job is unscheduled first inside a DO block (if it exists) then
     rescheduled so re-running the migration does not create duplicates.
*/

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing job with the same name to avoid duplicates
DO $$
BEGIN
  PERFORM cron.unschedule('trial_onboarding_daily');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist yet — safe to ignore
    NULL;
END $$;

-- Schedule the daily 09:00 Brasília (12:00 UTC) call to the Edge Function
SELECT cron.schedule(
  'trial_onboarding_daily',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := 'https://qjxhqvphnqzjpfqzqgco.supabase.co/functions/v1/trial-onboarding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true),
        'apikey', current_setting('app.supabase_anon_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
