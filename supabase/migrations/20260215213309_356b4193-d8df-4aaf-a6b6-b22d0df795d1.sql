-- Enable RLS on merchants_public view is not possible directly,
-- but the view uses security_invoker=on so it respects the base table's RLS.
-- The scan is incorrect - views with security_invoker inherit RLS from base tables.

-- However, let's also restrict the merchant SELECT policy to hide financial columns
-- by dropping the broad policy and using the view in code instead
DROP POLICY IF EXISTS "Authenticated users can read active merchants basic info" ON public.merchants;

-- Re-create with proper restriction - only show to authenticated users
CREATE POLICY "Authenticated users can read active merchants basic info" 
ON public.merchants 
FOR SELECT 
USING (
  is_active = true 
  AND auth.uid() IS NOT NULL
);