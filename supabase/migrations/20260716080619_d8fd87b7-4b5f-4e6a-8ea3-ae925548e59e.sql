
CREATE TABLE IF NOT EXISTS public.role_check_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  correlation_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('success','empty','error','retry_success')),
  resolved_role TEXT,
  reason TEXT,
  code TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  latency_ms INTEGER,
  route TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_check_audit_created_idx ON public.role_check_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS role_check_audit_user_idx ON public.role_check_audit (user_id);
CREATE INDEX IF NOT EXISTS role_check_audit_decision_idx ON public.role_check_audit (decision);

GRANT SELECT ON public.role_check_audit TO authenticated;
GRANT ALL ON public.role_check_audit TO service_role;

ALTER TABLE public.role_check_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit trail.
CREATE POLICY "Admins can read role_check_audit"
  ON public.role_check_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct writes from clients; the log_role_check() SECURITY DEFINER function is the only writer.
CREATE POLICY "No direct writes to role_check_audit"
  ON public.role_check_audit FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Secure logging function: callable by any signed-in user, but forces user_id = auth.uid()
-- so a client cannot forge rows for someone else. Anonymous callers get a NULL user_id row.
CREATE OR REPLACE FUNCTION public.log_role_check(
  _correlation_id TEXT,
  _decision TEXT,
  _resolved_role TEXT DEFAULT NULL,
  _reason TEXT DEFAULT NULL,
  _code TEXT DEFAULT NULL,
  _attempts INTEGER DEFAULT 1,
  _latency_ms INTEGER DEFAULT NULL,
  _route TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  IF _decision NOT IN ('success','empty','error','retry_success') THEN
    RAISE EXCEPTION 'invalid decision: %', _decision;
  END IF;

  INSERT INTO public.role_check_audit(
    user_id, correlation_id, decision, resolved_role, reason, code,
    attempts, latency_ms, route, user_agent, details
  ) VALUES (
    auth.uid(), _correlation_id, _decision, _resolved_role, _reason, _code,
    COALESCE(_attempts, 1), _latency_ms, _route, _user_agent, _details
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.log_role_check(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_role_check(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_role_check(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,TEXT,JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.log_role_check(TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,INTEGER,TEXT,TEXT,JSONB) TO service_role;
