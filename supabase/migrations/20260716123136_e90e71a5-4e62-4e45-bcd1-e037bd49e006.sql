
REVOKE EXECUTE ON FUNCTION public.sync_merchant_pending_from_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_merchant_pending_from_transfer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_merchant_pending_from_tx() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_merchant_pending_from_transfer() TO service_role;
