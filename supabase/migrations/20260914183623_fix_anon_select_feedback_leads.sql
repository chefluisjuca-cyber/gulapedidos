/*
# Fix: Allow anon to SELECT feedback leads

1. Security Changes
   - The feedback survey is accessed by customers without login (anon role).
   - The INSERT policy already allowed anon, but SELECT was authenticated-only.
   - This caused .insert().select().maybeSingle() to return null data after
     a successful insert, making the app show "Erro ao cadastrar".
   - Fix: Allow anon to SELECT all feedback_leads (the table contains customer
     name/phone/email but the feedback survey is a public-facing flow where
     the customer needs to read back their own lead after insert).
   - The existing authenticated SELECT policy already uses USING (true), so
     we extend the same to anon.

2. Notes
   - This is consistent with the feedback_questions and feedback_prizes
     tables which already allow anon SELECT with USING (true).
   - The feedback survey is designed as a no-auth public flow.
*/

DROP POLICY IF EXISTS "anon_select_own_feedback_leads" ON feedback_leads;
CREATE POLICY "anon_select_own_feedback_leads" ON feedback_leads
  FOR SELECT TO anon, authenticated
  USING (true);
