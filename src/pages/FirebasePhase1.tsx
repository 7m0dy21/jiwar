import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, LogOut } from "lucide-react";
import {
  signUpCustomer,
  signInCustomer,
  signOutCustomer,
  subscribeAuth,
} from "@/lib/firebaseAuth";
import { getCustomerByUid, type CustomerAccount } from "@/lib/firebaseCustomers";
import { isFirebaseConfigured } from "@/config/firebase";

type Mode = "signin" | "signup";

const FirebasePhase1 = () => {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setReady(true);
      return;
    }
    const unsub = subscribeAuth(async (user) => {
      setUid(user?.uid ?? null);
      if (user) {
        try {
          const c = await getCustomerByUid(user.uid);
          setAccount(c);
        } catch (e: any) {
          toast.error(e?.message || "تعذر تحميل بيانات الحساب");
        }
      } else {
        setAccount(null);
      }
      setReady(true);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { account } = await signUpCustomer(email, password, fullName, phone || undefined);
        setAccount(account);
        toast.success(`تم إنشاء الحساب. رقم حسابك: ${account.accountNumber}`);
      } else {
        await signInCustomer(email, password);
        toast.success("تم تسجيل الدخول");
      }
    } catch (e: any) {
      toast.error(e?.message || "فشلت العملية");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOutCustomer();
    setAccount(null);
    setUid(null);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم النسخ");
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Firebase غير مُهيّأ</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              أضف VITE_FIREBASE_API_KEY و VITE_FIREBASE_PROJECT_ID و VITE_FIREBASE_AUTH_DOMAIN إلى ملف .env
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ready) return <div className="min-h-screen flex items-center justify-center">...</div>;

  if (uid && account) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">حسابي في جوار</h1>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 ml-2" /> خروج
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle>رقم الحساب الثابت</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-2xl inline-block">
                <QRCodeSVG value={account.accountNumber} size={240} level="M" marginSize={2} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">رقم حسابك (فريد ودائم)</p>
                <div className="flex items-center justify-center gap-2">
                  <p dir="ltr" className="font-mono font-bold text-2xl tracking-widest text-primary">
                    {account.accountNumber}
                  </p>
                  <Button variant="ghost" size="icon" onClick={() => copy(account.accountNumber)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 text-right">
                <p><strong>الاسم:</strong> {account.fullName || "—"}</p>
                <p><strong>البريد:</strong> {account.email}</p>
                <p><strong>الجوال:</strong> {account.phone || "—"}</p>
                <p className="text-xs">UID: <span dir="ltr" className="font-mono">{account.uid}</span></p>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            المرحلة 1 من ترحيل Firebase — يتم توليد رقم الحساب داخل Firestore transaction ويُخزَّن في مجموعة <code>account_numbers</code> لضمان التفرّد.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "signup" ? "إنشاء حساب عميل" : "تسجيل الدخول"} (Firebase)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label>الاسم الكامل</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div>
                  <Label>الجوال</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
                </div>
              </>
            )}
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
            </div>
            <div>
              <Label>كلمة المرور</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : mode === "signup" ? "إنشاء الحساب" : "دخول"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "لديك حساب؟ سجّل الدخول" : "ليس لديك حساب؟ أنشئ حساباً جديداً"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirebasePhase1;
