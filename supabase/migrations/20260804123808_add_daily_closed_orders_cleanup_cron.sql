/*
# Daily cleanup of finalized orders at 3:00 AM

1. Purpose
   - Automatically deletes orders with status = 'closed' every day at 3:00 AM (server time).
   - This keeps the orders table clean — finalized orders are removed daily so the
     kitchen display and order monitor only show active orders.

2. Changes
   - Enables the `pg_cron` extension (Supabase's built-in scheduler).
   - Creates a scheduled job `cleanup_closed_orders` that runs at 03:00 every day.
   - The job deletes rows from `orders` where `status = 'closed'`.
   - Uses `ON DELETE CASCADE` semantics: `order_items` has a FK to `orders` with
     cascade delete, so deleting an order also removes its items automatically.

3. Security
   - No new tables created.
   - No RLS policy changes.
   - The cron job runs with elevated privileges (service role), bypassing RLS,
     which is the standard pattern for maintenance jobs.

4. Idempotency
   - Uses `DROP` before `CREATE` for the scheduled job so re-running is safe.
   - `CREATE EXTENSION IF NOT EXISTS` for pg_cron.
*/

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup_closed_orders');
EXCEPTION WHEN OTHERS THEN
  -- job doesn't exist yet, ignore
  NULL;
END $$;

-- Schedule the cleanup: every day at 03:00 AM
-- Deletes all orders with status = 'closed'
SELECT cron.schedule(
  'cleanup_closed_orders',
  '0 3 * * *',
  $$DELETE FROM orders WHERE status = 'closed'$$
);
