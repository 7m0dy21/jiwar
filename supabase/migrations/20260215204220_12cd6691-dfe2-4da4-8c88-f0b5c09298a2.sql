
-- Allow admins to delete customers
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete merchants
CREATE POLICY "Admins can delete merchants" ON public.merchants FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete related transactions
CREATE POLICY "Admins can delete transactions" ON public.transactions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete related payments
CREATE POLICY "Admins can delete payments" ON public.payments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete related notifications
CREATE POLICY "Admins can delete notifications" ON public.notifications FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete user_roles
CREATE POLICY "Admins can delete user_roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete monthly_statements
CREATE POLICY "Admins can delete statements" ON public.monthly_statements FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
