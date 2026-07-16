GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_limits(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_qr_audit(uuid, uuid, text, numeric, text, jsonb) TO authenticated;