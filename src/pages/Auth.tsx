import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jiwarLogo from "@/assets/jiwar-logo.png";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح").max(255),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").max(72),
  fullName: z.string().trim().min(1, "الاسم مطلوب").max(100),
  phone: z.string().trim().min(9, "رقم الجوال مطلوب").max(15),
});

const loginSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type AuthMode = "login" | "signup" | "reset" | "update-password";
type UserRole = "merchant" | "customer";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("customer");
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    storeName: "",
  });

  useEffect(() => {
    if (searchParams.get("mode") === "update-password") {
      setMode("update-password");
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "update-password") {
        if (newPassword.length < 6) {
          toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        toast.success("تم تغيير كلمة المرور بنجاح!");
        navigate("/dashboard");
      } else if (mode === "reset") {
        if (!form.email.trim()) {
          toast.error("يرجى إدخال البريد الإلكتروني");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
          redirectTo: `${window.location.origin}/auth?mode=update-password`,
        });
        if (error) throw error;
        toast.success("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني");
        setMode("login");
      } else if (mode === "signup") {
        const validation = signupSchema.safeParse(form);
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.fullName.trim(),
              phone: form.phone.trim(),
              role,
              store_name: role === "merchant" ? form.storeName.trim() : undefined,
            },
          },
        });

        if (error) throw error;
        toast.success("تم إنشاء الحساب بنجاح!");
        navigate("/dashboard");
      } else {
        const validation = loginSchema.safeParse(form);
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });

        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={jiwarLogo} alt="جوار" className="w-24 mx-auto mb-4" />
          <h1 className="text-2xl font-cairo font-bold text-foreground">
            {mode === "login" ? "تسجيل الدخول" : mode === "signup" ? "إنشاء حساب جديد" : mode === "reset" ? "استعادة كلمة المرور" : "تعيين كلمة مرور جديدة"}
          </h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-card">
          {mode === "signup" && (
            <div className="flex gap-2 mb-6">
              <Button
                type="button"
                variant={role === "customer" ? "default" : "outline"}
                className={`flex-1 ${role === "customer" ? "bg-gradient-primary text-primary-foreground" : ""}`}
                onClick={() => setRole("customer")}
              >
                عميل
              </Button>
              <Button
                type="button"
                variant={role === "merchant" ? "default" : "outline"}
                className={`flex-1 ${role === "merchant" ? "bg-gradient-primary text-primary-foreground" : ""}`}
                onClick={() => setRole("merchant")}
              >
                تاجر
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="fullName" className="font-cairo">الاسم الكامل</Label>
                  <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="phone" className="font-cairo">رقم الجوال</Label>
                  <Input id="phone" name="phone" value={form.phone} onChange={handleChange} required className="mt-1" dir="ltr" />
                </div>
                {role === "merchant" && (
                  <div>
                    <Label htmlFor="storeName" className="font-cairo">اسم المحل</Label>
                    <Input id="storeName" name="storeName" value={form.storeName} onChange={handleChange} required className="mt-1" />
                  </div>
                )}
              </>
            )}

            {mode === "update-password" ? (
              <div>
                <Label htmlFor="newPassword" className="font-cairo">كلمة المرور الجديدة</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="mt-1" dir="ltr" minLength={6} />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="email" className="font-cairo">البريد الإلكتروني</Label>
                  <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className="mt-1" dir="ltr" />
                </div>
                {mode !== "reset" && (
                  <div>
                    <Label htmlFor="password" className="font-cairo">كلمة المرور</Label>
                    <Input id="password" name="password" type="password" value={form.password} onChange={handleChange} required className="mt-1" dir="ltr" />
                  </div>
                )}

                {mode === "login" && (
                  <div className="text-left">
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-sm text-primary hover:underline font-ibm"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                )}
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground font-bold text-lg py-6 rounded-xl glow-green">
              {loading ? "جارٍ التحميل..." : mode === "login" ? "دخول" : mode === "signup" ? "إنشاء حساب" : mode === "reset" ? "إرسال رابط الاستعادة" : "تحديث كلمة المرور"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6 font-ibm">
            {mode === "reset" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary font-bold hover:underline"
              >
                العودة لتسجيل الدخول
              </button>
            ) : (
              <>
                {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-primary font-bold hover:underline"
                >
                  {mode === "login" ? "سجّل الآن" : "سجّل دخولك"}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
