
-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'overdue', 'partial');

-- Monthly statements / invoices for customers
CREATE TABLE public.monthly_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monthly_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own statements" ON public.monthly_statements
  FOR SELECT USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can update own statements" ON public.monthly_statements
  FOR UPDATE USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE TRIGGER update_monthly_statements_updated_at
  BEFORE UPDATE ON public.monthly_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payments (actual money paid by customer)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  statement_id UUID REFERENCES public.monthly_statements(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'mada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own payments" ON public.payments
  FOR SELECT USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can insert own payments" ON public.payments
  FOR INSERT WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function: make a payment and restore credit
CREATE OR REPLACE FUNCTION public.make_payment(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT 'mada'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
  v_customer customers%ROWTYPE;
  v_owed NUMERIC;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id FOR UPDATE;
  
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'العميل غير موجود';
  END IF;

  v_owed := v_customer.credit_limit - v_customer.available_balance;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
  END IF;

  IF p_amount > v_owed THEN
    p_amount := v_owed; -- cap at what's owed
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

-- Trigger: notify customer on new transaction
CREATE OR REPLACE FUNCTION public.notify_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM customers WHERE id = NEW.customer_id;
  
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_user_id, 'عملية شراء جديدة', 'تم خصم ' || NEW.amount || ' ر.س من رصيدك', 'transaction');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_transaction();
