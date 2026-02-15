
-- Admin can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all merchants
CREATE POLICY "Admins can read all merchants" ON public.merchants
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update merchants" ON public.merchants
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all customers
CREATE POLICY "Admins can read all customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update customers" ON public.customers
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all transactions
CREATE POLICY "Admins can read all transactions" ON public.transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all user_roles
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all payments
CREATE POLICY "Admins can read all payments" ON public.payments
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all notifications
CREATE POLICY "Admins can read all notifications" ON public.notifications
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can read all statements
CREATE POLICY "Admins can read all statements" ON public.monthly_statements
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
