/*
# Auto-suspend restaurants with expired trials

1. Purpose
   - Automatically flips `restaurants.status` from 'trial' to 'suspended' when
     `trial_ends_at` is in the past (i.e. the 7-day trial has expired).
   - Runs every 10 minutes via pg_cron so the Super Admin dashboard reflects
     reality without manual intervention.

2. Approach
   - A SECURITY DEFINER function `auto_suspend_expired_trials()` performs the
     UPDATE so it can run with elevated privileges regardless of the caller.
   - A cron schedule calls it every 10 minutes.
   - The function is idempotent: only rows with status='trial' AND
     trial_ends_at < NOW() are touched.

3. Security
   - The function is SECURITY DEFINER, owned by postgres, and NOT exposed to
     any role (no EXECUTE grant). It can only be invoked by the cron schedule.
   - No RLS policy changes.

4. Notes
   - Requires pg_cron extension (already enabled in this project).
*/

-- Ensure pg_cron is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- The function that does the actual work
CREATE OR REPLACE FUNCTION public.auto_suspend_expired_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE restaurants
  SET status = 'suspended',
      updated_at = NOW()
  WHERE status = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW();
END;
$$;

-- Revoke execute from all roles; only the cron scheduler should call it
REVOKE EXECUTE ON FUNCTION public.auto_suspend_expired_trials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_suspend_expired_trials() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_suspend_expired_trials() FROM anon;

-- Schedule it every 10 minutes (pg_cron uses GMT)
SELECT cron.schedule(
  'auto-suspend-expired-trials',
  '*/10 * * * *',
  $$SELECT public.auto_suspend_expired_trials();$$
);

-- Run once immediately so the dashboard is correct right now
SELECT public.auto_suspend_expired_trials();
