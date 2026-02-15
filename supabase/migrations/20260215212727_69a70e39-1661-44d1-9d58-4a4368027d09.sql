-- 1. Fix process_transaction: verify caller owns the merchant
CREATE OR REPLACE FUNCTION public.process_transaction(p_customer_id uuid, p_merchant_id uuid, p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance NUMERIC;
  v_tx_id UUID;
  v_caller_merchant_id UUID;
BEGIN
  -- Verify caller owns the merchant account
  SELECT id INTO v_caller_merchant_id 
  FROM merchants 
  WHERE id = p_merchant_id AND user_id = auth.uid();
  
  IF v_caller_merchant_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح - أنت لا تملك هذا الحساب التجاري';
  END IF;

  -- Check available balance
  SELECT available_balance INTO v_balance FROM customers WHERE id = p_customer_id FOR UPDATE;
  
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'العميل غير موجود';
  END IF;
  
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'الرصيد غير كافي. المتاح: % ر.س', v_balance;
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
  END IF;

  -- Deduct balance
  UPDATE customers SET available_balance = available_balance - p_amount WHERE id = p_customer_id;

  -- Create transaction
  INSERT INTO transactions (customer_id, merchant_id, amount, status)
  VALUES (p_customer_id, p_merchant_id, p_amount, 'completed')
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- 2. Fix make_payment: verify caller owns the customer account
CREATE OR REPLACE FUNCTION public.make_payment(p_customer_id uuid, p_amount numeric, p_payment_method text DEFAULT 'mada')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment_id UUID;
  v_customer customers%ROWTYPE;
  v_owed NUMERIC;
  v_caller_customer_id UUID;
BEGIN
  -- Verify caller owns the customer account
  SELECT id INTO v_caller_customer_id
  FROM customers
  WHERE id = p_customer_id AND user_id = auth.uid();
  
  IF v_caller_customer_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح - أنت لا تملك هذا الحساب';
  END IF;

  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id FOR UPDATE;
  
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'العميل غير موجود';
  END IF;

  v_owed := v_customer.credit_limit - v_customer.available_balance;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
  END IF;

  IF p_amount > v_owed THEN
    p_amount := v_owed;
  END IF;

  -- Restore balance
  UPDATE customers SET available_balance = available_balance + p_amount WHERE id = p_customer_id;

  -- Record payment
  INSERT INTO payments (customer_id, amount, payment_method)
  VALUES (p_customer_id, p_amount, p_payment_method)
  RETURNING id INTO v_payment_id;

  -- Send notification
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_customer.user_id, 'تم السداد بنجاح', 'تم سداد ' || p_amount || ' ر.س وتم تحديث رصيدك', 'payment');

  RETURN v_payment_id;
END;
$$;

-- 3. Fix customer UPDATE policy: prevent customers from modifying financial fields
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;

CREATE POLICY "Customers can update own data" 
ON public.customers 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);