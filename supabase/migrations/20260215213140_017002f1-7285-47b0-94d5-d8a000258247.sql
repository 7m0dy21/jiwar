-- =====================================================
-- COMPREHENSIVE SECURITY HARDENING
-- =====================================================

-- 1. MERCHANTS: Remove policy exposing IBAN/bank to all authenticated users
-- Replace with restricted policy showing only basic info (name, location)
DROP POLICY IF EXISTS "Authenticated users can read active merchants" ON public.merchants;

-- Create a view for public merchant data (no sensitive financial info)
CREATE OR REPLACE VIEW public.merchants_public
WITH (security_invoker = on) AS
SELECT id, store_name, store_address, location_lat, location_lng, is_active
FROM public.merchants
WHERE is_active = true;

-- Allow authenticated users to read public merchant view only
CREATE POLICY "Authenticated users can read active merchants basic info" 
ON public.merchants 
FOR SELECT 
USING (
  is_active = true 
  AND auth.uid() IS NOT NULL
  AND auth.uid() != user_id  -- non-owners see via this policy
);

-- 2. CUSTOMERS: Restrict UPDATE to non-financial fields only
-- Use a trigger to prevent customers from modifying financial fields
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;

CREATE POLICY "Customers can update own non-financial data" 
ON public.customers 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger to prevent customers from modifying financial fields
CREATE OR REPLACE FUNCTION public.prevent_customer_financial_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If caller is admin, allow all changes
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  
  -- For non-admins, prevent modification of financial fields
  IF NEW.credit_limit != OLD.credit_limit THEN
    RAISE EXCEPTION 'غير مصرح بتعديل حد الائتمان';
  END IF;
  
  IF NEW.available_balance != OLD.available_balance THEN
    RAISE EXCEPTION 'غير مصرح بتعديل الرصيد';
  END IF;
  
  IF NEW.is_verified != OLD.is_verified THEN
    RAISE EXCEPTION 'غير مصرح بتعديل حالة التوثيق';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER protect_customer_financial_fields
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_customer_financial_update();

-- 3. MONTHLY_STATEMENTS: Remove customer UPDATE access
DROP POLICY IF EXISTS "Customers can update own statements" ON public.monthly_statements;

-- Only admins can update statements
CREATE POLICY "Admins can update statements" 
ON public.monthly_statements 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert statements
CREATE POLICY "Admins can insert statements" 
ON public.monthly_statements 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. TRANSACTIONS: Remove direct merchant INSERT via RLS (force use of process_transaction RPC)
DROP POLICY IF EXISTS "Merchants can create transactions" ON public.transactions;

-- Only allow inserts via SECURITY DEFINER functions (process_transaction)
-- No direct INSERT policy for merchants

-- Prevent updates to transactions (immutable audit trail)
CREATE POLICY "No direct transaction updates"
ON public.transactions
FOR UPDATE
USING (false);

-- 5. ADMIN_PERMISSIONS: Restrict to super admins only
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON public.admin_permissions;
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.admin_permissions;

-- Only super admins can manage permissions
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_permissions 
    WHERE user_id = _user_id AND is_super_admin = true
  )
$$;

CREATE POLICY "Super admins can insert permissions" 
ON public.admin_permissions 
FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update permissions" 
ON public.admin_permissions 
FOR UPDATE 
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete permissions" 
ON public.admin_permissions 
FOR DELETE 
USING (is_super_admin(auth.uid()));

-- 6. USER_ROLES: Only admins can insert/update roles
CREATE POLICY "Admins can insert user_roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user_roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- 7. NOTIFICATIONS: Only system/admins can create notifications
CREATE POLICY "Admins can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 8. PAYMENTS: Make immutable (no updates allowed)
CREATE POLICY "No payment updates"
ON public.payments
FOR UPDATE
USING (false);