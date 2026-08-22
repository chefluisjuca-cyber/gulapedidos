-- Extend auth_owned_restaurant_ids to also return all restaurants when the user is a super admin
CREATE OR REPLACE FUNCTION public.auth_owned_restaurant_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT id FROM restaurants WHERE owner_email = auth.email()
  UNION
  SELECT id FROM restaurants WHERE EXISTS (
    SELECT 1 FROM super_admins WHERE email = auth.email()
  );
$$;
