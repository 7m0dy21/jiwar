-- Create triggers for automatic Google Sheets sync
CREATE OR REPLACE TRIGGER sync_customers_to_sheets
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_sheets_export();

CREATE OR REPLACE TRIGGER sync_merchants_to_sheets
AFTER INSERT OR UPDATE OR DELETE ON public.merchants
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_sheets_export();

CREATE OR REPLACE TRIGGER sync_transactions_to_sheets
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_sheets_export();

CREATE OR REPLACE TRIGGER sync_profiles_to_sheets
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_sheets_export();