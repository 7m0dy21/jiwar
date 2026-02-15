
-- Fix ALL RLS policies: change from RESTRICTIVE to PERMISSIVE

-- ===== CUSTOMERS =====
DROP POLICY IF EXISTS "Admins can read all customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can insert own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can read own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;

CREATE POLICY "Admins can read all customers" ON public.customers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers can insert own data" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Customers can read own data" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Customers can update own data" ON public.customers FOR UPDATE USING (auth.uid() = user_id);

-- ===== MERCHANTS =====
DROP POLICY IF EXISTS "Admins can read all merchants" ON public.merchants;
DROP POLICY IF EXISTS "Admins can update merchants" ON public.merchants;
DROP POLICY IF EXISTS "Authenticated users can read active merchants" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can insert own data" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can read own data" ON public.merchants;
DROP POLICY IF EXISTS "Merchants can update own data" ON public.merchants;

CREATE POLICY "Admins can read all merchants" ON public.merchants FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update merchants" ON public.merchants FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can read active merchants" ON public.merchants FOR SELECT USING (is_active = true);
CREATE POLICY "Merchants can insert own data" ON public.merchants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Merchants can read own data" ON public.merchants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Merchants can update own data" ON public.merchants FOR UPDATE USING (auth.uid() = user_id);

-- ===== PROFILES =====
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- ===== TRANSACTIONS =====
DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Customers can read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Merchants can create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Merchants can read own transactions" ON public.transactions;

CREATE POLICY "Admins can read all transactions" ON public.transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers can read own transactions" ON public.transactions FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Merchants can create transactions" ON public.transactions FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
CREATE POLICY "Merchants can read own transactions" ON public.transactions FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- ===== USER_ROLES =====
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ===== NOTIFICATIONS =====
DROP POLICY IF EXISTS "Admins can read all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Admins can read all notifications" ON public.notifications FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ===== PAYMENTS =====
DROP POLICY IF EXISTS "Admins can read all payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Customers can read own payments" ON public.payments;

CREATE POLICY "Admins can read all payments" ON public.payments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers can insert own payments" ON public.payments FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can read own payments" ON public.payments FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- ===== MONTHLY_STATEMENTS =====
DROP POLICY IF EXISTS "Admins can read all statements" ON public.monthly_statements;
DROP POLICY IF EXISTS "Customers can read own statements" ON public.monthly_statements;
DROP POLICY IF EXISTS "Customers can update own statements" ON public.monthly_statements;

CREATE POLICY "Admins can read all statements" ON public.monthly_statements FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers can read own statements" ON public.monthly_statements FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can update own statements" ON public.monthly_statements FOR UPDATE USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

-- ===== ADMIN_PERMISSIONS =====
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "Admins can read all permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON public.admin_permissions;

CREATE POLICY "Admins can read all permissions" ON public.admin_permissions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert permissions" ON public.admin_permissions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update permissions" ON public.admin_permissions FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete permissions" ON public.admin_permissions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
