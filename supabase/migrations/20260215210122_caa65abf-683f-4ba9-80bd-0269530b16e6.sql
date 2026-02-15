
-- Add IBAN and bank name columns to merchants table
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS bank_name text;

-- Create merchant_transfers table for tracking balance transfers to merchants
CREATE TABLE public.merchant_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  iban text,
  bank_name text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage merchant_transfers" ON public.merchant_transfers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Merchants can read own transfers" ON public.merchant_transfers
  FOR SELECT USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));
