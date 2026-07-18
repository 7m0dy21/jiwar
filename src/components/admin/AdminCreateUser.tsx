import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { getFirebaseAuth, getDb } from "@/config/firebase";
import { ensureCustomerAccount } from "@/lib/firebaseCustomers";
import { ensureMerchantAccount } from "@/lib/firebaseMerchants";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

const AdminCreateUser = () => {
  const [type, setType] = useState<"customer" | "merchant">("customer");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    storeName: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف فأكثر");
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        form.email.trim(),
        form.password,
      );
      const uid = cred.user.uid;
      if (type === "customer") {
        await ensureCustomerAccount(uid, {
          fullName: form.fullName,
          phone: form.phone || null,
          email: form.email.trim(),
        });
        await updateDoc(doc(getDb(), "customers", uid), { is_verified: true });
      } else {
        await ensureMerchantAccount(uid, {
          storeName: form.storeName,
          phone: form.phone || null,
          email: form.email.trim(),
        });
        await updateDoc(doc(getDb(), "merchants", uid), { is_verified: true });
      }
      toast.success("تم إنشاء الحساب وتوثيقه");
      setForm({ email: "", password: "", fullName: "", storeName: "", phone: "" });
    } catch (e: any) {
      toast.error(e?.message || "فشل إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <SidebarTrigger />
        <h1 className="text-2xl font-cairo font-bold">إنشاء مستخدم يدوياً</h1>
      </div>

      <Card className="max-w-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-primary" /> تسجيل حساب جديد وتوثيقه تلقائياً
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant={type === "customer" ? "default" : "outline"}
              onClick={() => setType("customer")}
            >
              عميل
            </Button>
            <Button
              size="sm"
              variant={type === "merchant" ? "default" : "outline"}
              onClick={() => setType("merchant")}
            >
              تاجر
            </Button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input
                dir="ltr"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>
            <div>
              <Label>كلمة المرور المؤقتة</Label>
              <Input
                dir="ltr"
                type="text"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
              />
            </div>
            {type === "customer" ? (
              <div>
                <Label>الاسم الكامل</Label>
                <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
              </div>
            ) : (
              <div>
                <Label>اسم المتجر</Label>
                <Input value={form.storeName} onChange={(e) => update("storeName", e.target.value)} required />
              </div>
            )}
            <div>
              <Label>الجوال</Label>
              <Input dir="ltr" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "جارٍ الإنشاء..." : "إنشاء وتوثيق"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              ملاحظة: سيتم تسجيل دخولك بحساب المستخدم الجديد. سجّل خروج ثم ادخل بحسابك بعد الإنشاء.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCreateUser;
