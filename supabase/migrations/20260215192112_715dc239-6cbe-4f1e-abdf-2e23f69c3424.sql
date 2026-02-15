-- Allow authenticated users to read active merchants (public store info)
CREATE POLICY "Authenticated users can read active merchants"
ON public.merchants
FOR SELECT
TO authenticated
USING (is_active = true);
