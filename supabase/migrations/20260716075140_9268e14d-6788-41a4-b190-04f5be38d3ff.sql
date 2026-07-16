-- Unified error log table for auth/role fetch failures and other client-side incidents
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correlation_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  code TEXT,
  message TEXT NOT NULL,
  details JSONB,
  user_agent TEXT,
  route TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_user_id ON public.error_logs (user_id);
CREATE INDEX idx_error_logs_source ON public.error_logs (source);
CREATE INDEX idx_error_logs_correlation ON public.error_logs (correlation_id);

GRANT SELECT, INSERT ON public.error_logs TO authenticated;
GRANT INSERT ON public.error_logs TO anon;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous, e.g. before/after sign-in) can write an error log entry
CREATE POLICY "Anyone can insert error logs"
  ON public.error_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can read only their own logs
CREATE POLICY "Users read their own error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read every log
CREATE POLICY "Admins read all error logs"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete logs (e.g. cleanup)
CREATE POLICY "Admins delete error logs"
  ON public.error_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
