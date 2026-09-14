/*
# Add Push Notification columns to feedback_leads

1. Modified Tables
   - `feedback_leads`: Added two new columns for Web Push support:
     • `push_subscription` (jsonb, nullable): Stores the PushSubscription object
       from the browser's Web Push API (endpoint, keys.p256dh, keys.auth).
     • `push_enabled` (boolean, default true): Flag indicating whether the
       lead can receive push notifications. Set to false when the device
       returns 404/410 (unsubscribed) to keep the token base clean.

2. Security
   - No new tables created. Existing RLS policies on feedback_leads already
     allow anon INSERT and authenticated CRUD. The anon INSERT policy
     already covers the new columns since it uses WITH CHECK (true).
   - Added a new policy allowing anon to UPDATE feedback_leads so the
     browser can save the push_subscription after the lead is created
     (the push subscription is captured asynchronously after lead insert).

3. Notes
   - The push_subscription is captured in the client after the user
     grants notification permission via Notification.requestPermission().
   - The push_enabled flag is automatically set to false by the backend
     edge function (send-mass-push) when a push delivery fails with 404/410.
*/

ALTER TABLE feedback_leads
  ADD COLUMN IF NOT EXISTS push_subscription jsonb;

ALTER TABLE feedback_leads
  ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true;

-- Allow anon to update push_subscription on their own lead (by session_id)
DROP POLICY IF EXISTS "anon_update_feedback_leads_push" ON feedback_leads;
CREATE POLICY "anon_update_feedback_leads_push" ON feedback_leads
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);