
-- 1) type-level toggles on notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS type_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
    'transaction', jsonb_build_object('in_app', true, 'push', true),
    'payment',     jsonb_build_object('in_app', true, 'push', true),
    'reminder',    jsonb_build_object('in_app', true, 'push', true),
    'settlement',  jsonb_build_object('in_app', true, 'push', true),
    'warning',     jsonb_build_object('in_app', true, 'push', true),
    'info',        jsonb_build_object('in_app', true, 'push', false),
    'test',        jsonb_build_object('in_app', true, 'push', true)
  );

-- 2) delivery tracking on notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'delivered',
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 3) device tokens (labels for user's push devices)
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  label text,
  platform text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens"
  ON public.device_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4) helper RPC: send test notification (creates in-app row; DB trigger dispatches push)
CREATE OR REPLACE FUNCTION public.send_test_notification(p_token text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, channel, delivery_status, metadata)
  VALUES (
    auth.uid(),
    'إشعار تجريبي',
    'هذا إشعار تجريبي من جوار للتحقق من وصول الإشعارات إلى جهازك.',
    'test',
    CASE WHEN p_token IS NULL THEN 'in_app' ELSE 'push' END,
    'queued',
    CASE WHEN p_token IS NULL THEN NULL ELSE jsonb_build_object('target_token', p_token) END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_test_notification(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_test_notification(text) TO authenticated;
