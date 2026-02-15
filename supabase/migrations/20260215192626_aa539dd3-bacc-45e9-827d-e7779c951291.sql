-- Admin permissions table
CREATE TABLE public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  can_manage_customers boolean NOT NULL DEFAULT false,
  can_manage_merchants boolean NOT NULL DEFAULT false,
  can_manage_transactions boolean NOT NULL DEFAULT false,
  can_manage_admins boolean NOT NULL DEFAULT false,
  can_view_reports boolean NOT NULL DEFAULT true,
  is_super_admin boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read all permissions"
ON public.admin_permissions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only super admins or the creator can update
CREATE POLICY "Admins can update permissions"
ON public.admin_permissions FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert permissions"
ON public.admin_permissions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete permissions"
ON public.admin_permissions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_admin_permissions_updated_at
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Mark the first admin as super_admin
INSERT INTO public.admin_permissions (user_id, can_manage_customers, can_manage_merchants, can_manage_transactions, can_manage_admins, can_view_reports, is_super_admin)
VALUES ('43cbd777-9523-4e8c-a692-a9bf2fff9819', true, true, true, true, true, true);
