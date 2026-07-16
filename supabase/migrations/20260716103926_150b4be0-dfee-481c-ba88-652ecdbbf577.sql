
CREATE TABLE public.verification_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verification_id UUID,
  customer_id UUID,
  provider TEXT,
  action TEXT NOT NULL CHECK (action IN ('insert','update')),
  old_status TEXT,
  new_status TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','failure')),
  actor_role TEXT NOT NULL,
  actor_user_id UUID,
  source TEXT,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.verification_audit_log TO authenticated;
GRANT ALL ON public.verification_audit_log TO service_role;

ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read verification audit"
  ON public.verification_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own verification audit"
  ON public.verification_audit_log FOR SELECT
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE INDEX idx_verification_audit_customer ON public.verification_audit_log(customer_id, created_at DESC);
CREATE INDEX idx_verification_audit_verification ON public.verification_audit_log(verification_id, created_at DESC);

-- Trigger function: logs every insert/update on customer_verifications
CREATE OR REPLACE FUNCTION public.log_customer_verification_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := current_setting('request.jwt.claim.role', true);
  v_actor UUID := auth.uid();
  v_source TEXT := current_setting('request.headers', true);
  v_outcome TEXT := 'success';
  v_new_status TEXT;
  v_old_status TEXT;
  v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_new_status := NEW.status;
    v_old_status := NULL;
  ELSE
    v_action := 'update';
    v_new_status := NEW.status;
    v_old_status := OLD.status;
  END IF;

  INSERT INTO public.verification_audit_log(
    verification_id, customer_id, provider, action,
    old_status, new_status, outcome,
    actor_role, actor_user_id, source, reason, details
  ) VALUES (
    NEW.id, NEW.customer_id, NEW.provider, v_action,
    v_old_status, v_new_status, v_outcome,
    COALESCE(v_role, 'unknown'), v_actor,
    CASE WHEN v_role = 'service_role' THEN 'edge_function' ELSE 'client' END,
    NEW.details->>'reason',
    NEW.details
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_customer_verification_change
AFTER INSERT OR UPDATE ON public.customer_verifications
FOR EACH ROW EXECUTE FUNCTION public.log_customer_verification_change();

-- Helper RPC for edge functions to explicitly log failures (inserts don't happen on failure paths)
CREATE OR REPLACE FUNCTION public.log_verification_failure(
  p_customer_id UUID,
  p_provider TEXT,
  p_reason TEXT,
  p_details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.verification_audit_log(
    customer_id, provider, action, new_status, outcome,
    actor_role, actor_user_id, source, reason, details
  ) VALUES (
    p_customer_id, p_provider, 'insert', 'rejected', 'failure',
    COALESCE(current_setting('request.jwt.claim.role', true), 'unknown'),
    auth.uid(),
    CASE WHEN current_setting('request.jwt.claim.role', true) = 'service_role' THEN 'edge_function' ELSE 'client' END,
    p_reason, p_details
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_verification_failure(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_verification_failure(UUID, TEXT, TEXT, JSONB) TO service_role;
