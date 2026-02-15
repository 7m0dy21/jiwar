import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("غير مصرح");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an admin with can_manage_admins permission
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) throw new Error("غير مصرح");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller permissions
    const { data: callerPerms } = await adminClient
      .from("admin_permissions")
      .select("*")
      .eq("user_id", caller.id)
      .single();

    if (!callerPerms || (!callerPerms.is_super_admin && !callerPerms.can_manage_admins)) {
      throw new Error("ليس لديك صلاحية إنشاء مشرفين");
    }

    const { email, password, full_name, phone, permissions } = await req.json();

    if (!email || !password || !full_name) {
      throw new Error("البريد الإلكتروني وكلمة المرور والاسم مطلوبة");
    }

    // Create user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone || "", role: "admin" },
    });

    if (createError) throw new Error(createError.message);

    const userId = newUser.user.id;

    // Create profile
    await adminClient.from("profiles").insert({
      user_id: userId,
      full_name,
      phone: phone || null,
    });

    // Assign admin role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role: "admin",
    });

    // Set permissions
    await adminClient.from("admin_permissions").insert({
      user_id: userId,
      can_manage_customers: permissions?.can_manage_customers ?? false,
      can_manage_merchants: permissions?.can_manage_merchants ?? false,
      can_manage_transactions: permissions?.can_manage_transactions ?? false,
      can_manage_admins: permissions?.can_manage_admins ?? false,
      can_view_reports: permissions?.can_view_reports ?? true,
      is_super_admin: false,
      created_by: caller.id,
    });

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
