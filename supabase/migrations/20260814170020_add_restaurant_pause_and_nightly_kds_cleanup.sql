/*
# Add restaurant pause + nightly KDS cleanup

1. New Column
   - `restaurant_settings.paused_until` (timestamptz, nullable): when non-null
     and in the future, the restaurant is temporarily paused (not accepting
     new orders). The customer-facing menu shows a friendly message with the
     resume time. When NULL or in the past, the restaurant is open.

2. Nightly KDS Cleanup Function + Cron
   - `archive_old_ready_orders()` moves orders with status 'ready' that are
     older than 4 hours to status 'closed', removing them from the KDS
     production monitor while keeping them in sales history/analytics.
   - `archive_old_closed_orders()` is a safety net that closes any
     'pending'/'preparing'/'ready' orders older than 24h (prevents stale
     tickets from accumulating if staff forgot to advance them).
   - Scheduled daily at 04:00 GMT via pg_cron.

3. Security
   - Functions are SECURITY DEFINER, owned by postgres, no EXECUTE grants.
   - No RLS policy changes.
*/

-- ── Pause column ────────────────────────────────────────────────────────
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS paused_until timestamptz;

-- ── Nightly KDS cleanup function ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.archive_old_ready_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Close 'ready' orders older than 4 hours (removes them from KDS)
  UPDATE orders
  SET status = 'closed', updated_at = NOW()
  WHERE status = 'ready'
    AND created_at < NOW() - INTERVAL '4 hours';

  -- Safety net: auto-close any pending/preparing/ready orders older than 24h
  -- (prevents stale tickets from lingering on the KDS overnight)
  UPDATE orders
  SET status = 'closed', updated_at = NOW()
  WHERE status IN ('pending', 'preparing', 'ready')
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_old_ready_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.archive_old_ready_orders() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.archive_old_ready_orders() FROM anon;

-- Schedule daily at 04:00 GMT
SELECT cron.schedule(
  'archive-old-ready-orders-nightly',
  '0 4 * * *',
  $$SELECT public.archive_old_ready_orders();$$
);

-- Run once immediately to clean up any currently stale orders
SELECT public.archive_old_ready_orders();
