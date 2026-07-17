import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jiwarLogo from "@/assets/jiwar-logo.png";
import { toast } from "sonner";
import { z } from "zod";
import {
  signInEmail,
  signUpCustomer,
  signUpMerchant,
  subscribeAuth,
} from "@/lib/firebaseAuth";
import { isFirebaseConfigured } from "@/config/firebase";
import { isUserAdmin } from "@/lib/firebaseAdmins";

const signupSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح").max(255),
  password: z.string().min(6, "كلمة المرور 6 أحرف على الأقل").max(72),
  fullName: z.string().trim().min(1, "الاسم مطلوب").max(100),
  phone: z.string().trim().min(9, "رقم الجوال مطلوب").max(15),
});

const loginSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type AuthMode = "login" | "signup";
type UserRole = "merchant" | "customer";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("customer");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", fullName: "", phone: "", storeName: "",
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeAuth(async (u) => {
      if (!u) return;
      const admin = await isUserAdmin(u.uid).catch(() => false);
      navigate(admin ? "/admin" : "/dashboard", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured()) { toast.error("إعدادات Firebase غير مكتملة"); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.errors[0].message); setLoading(false); return; }
        if (role === "merchant" && !form.storeName.trim()) { toast.error("اسم المحل مطلوب"); setLoading(false); return; }
        if (role === "customer") {
          await signUpCustomer(form.email.trim(), form.password, form.fullName.trim(), form.phone.trim());
        } else {
          await signUpMerchant(form.email.trim(), form.password, form.storeName.trim(), form.phone.trim());
        }
        toast.success("تم إنشاء الحساب بنجاح!");
      } else {
        const parsed = loginSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.errors[0].message); setLoading(false); return; }
        await signInEmail(form.email.trim(), form.password);
        toast.success("تم تسجيل الدخول بنجاح!");
      }
    } catch (err: any) {
      const msg = err?.code === "auth/invalid-credential" ? "بيانات الدخول غير صحيحة"
        : err?.code === "auth/email-already-in-use" ? "البريد الإلكتروني مسجّل مسبقاً"
        : err?.message || "حدث خطأ";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={jiwarLogo} alt="جوار" className="w-24 mx-auto mb-4" />
          <h1 className="text-2xl font-cairo font-bold text-foreground">
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-card">
          {mode === "signup" && (
            <div className="flex gap-2 mb-6">
              <Button type="button" variant={role === "customer" ? "default" : "outline"}
                className={`flex-1 ${role === "customer" ? "bg-gradient-primary text-primary-foreground" : ""}`}
                onClick={() => setRole("customer")}>عميل</Button>
              <Button type="button" variant={role === "merchant" ? "default" : "outline"}
                className={`flex-1 ${role === "merchant" ? "bg-gradient-primary text-primary-foreground" : ""}`}
                onClick={() => setRole("merchant")}>تاجر</Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="fullName" className="font-cairo">
                    {role === "merchant" ? "اسم المسؤول" : "الاسم الكامل"}
                  </Label>
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
            <div>
              <Label htmlFor="email" className="font-cairo">البريد الإلكتروني</Label>
              <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label htmlFor="password" className="font-cairo">كلمة المرور</Label>
              <Input id="password" name="password" type="password" value={form.password} onChange={handleChange} required className="mt-1" dir="ltr" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground font-bold text-lg py-6 rounded-xl glow-green">
              {loading ? "جارٍ التحميل..." : mode === "login" ? "دخول" : "إنشاء حساب"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6 font-ibm">
            {mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-bold hover:underline">
              {mode === "login" ? "سجّل الآن" : "سجّل دخولك"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
