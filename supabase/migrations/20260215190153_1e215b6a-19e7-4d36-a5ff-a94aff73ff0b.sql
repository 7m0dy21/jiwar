
-- Transaction status enum
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'completed',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Customers can see their own transactions
CREATE POLICY "Customers can read own transactions"
ON public.transactions FOR SELECT
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
);

-- Merchants can see their own transactions
CREATE POLICY "Merchants can read own transactions"
ON public.transactions FOR SELECT
USING (
  merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
);

-- Merchants can insert transactions (when scanning QR)
CREATE POLICY "Merchants can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
);

-- Function to process a transaction: deducts from customer balance
CREATE OR REPLACE FUNCTION public.process_transaction(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_tx_id UUID;
BEGIN
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

-- Auto-generate QR code for new customers (use their customer id)
CREATE OR REPLACE FUNCTION public.auto_set_qr_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.qr_code := 'JIWAR-' || NEW.id::text;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_customer_qr_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_qr_code();

-- Update existing customers that don't have QR codes
UPDATE public.customers SET qr_code = 'JIWAR-' || id::text WHERE qr_code IS NULL;

-- Enable realtime for transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
