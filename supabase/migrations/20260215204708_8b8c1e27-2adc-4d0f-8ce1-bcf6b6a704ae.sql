
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to trigger sheets export via edge function
CREATE OR REPLACE FUNCTION public.trigger_sheets_export()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call the export-to-sheets edge function asynchronously
  PERFORM extensions.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/export-to-sheets',
    body := '{}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on customers table
CREATE TRIGGER trigger_sheets_on_customers
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sheets_export();

-- Trigger on merchants table  
CREATE TRIGGER trigger_sheets_on_merchants
AFTER INSERT OR UPDATE OR DELETE ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sheets_export();

-- Trigger on transactions table
CREATE TRIGGER trigger_sheets_on_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sheets_export();

-- Trigger on profiles table (for name/phone updates)
CREATE TRIGGER trigger_sheets_on_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sheets_export();
