import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, LogOut, Store, User as UserIcon, Wallet } from "lucide-react";
import {
  signUpCustomer,
  signUpMerchant,
  signInEmail,
  signOutUser,
  subscribeAuth,
  type UserRole,
} from "@/lib/firebaseAuth";

import { getCustomerByUid, type CustomerAccount } from "@/lib/firebaseCustomers";
import { getMerchantByUid, type MerchantAccount } from "@/lib/firebaseMerchants";
import {
  createMerchantTransaction,
  subscribeCustomerTransactions,
  subscribeMerchantTransactions,
  type TransactionRecord,
} from "@/lib/firebaseTransactions";
import { isFirebaseConfigured } from "@/config/firebase";
import MerchantQRScanner from "@/components/firebase/MerchantQRScanner";
import CustomerApprovalModal from "@/components/firebase/CustomerApprovalModal";

type Mode = "signin" | "signup";

const FirebasePhase1 = () => {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [merchant, setMerchant] = useState<MerchantAccount | null>(null);
  const [txs, setTxs] = useState<TransactionRecord[]>([]);

  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<UserRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  // merchant scan form
  const [scanAcct, setScanAcct] = useState("");
  const [scanAmount, setScanAmount] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) { setReady(true); return; }
    const unsub = subscribeAuth(async (user) => {
      setUid(user?.uid ?? null);
      if (user) {
        const [c, m] = await Promise.all([
          getCustomerByUid(user.uid).catch(() => null),
          getMerchantByUid(user.uid).catch(() => null),
        ]);
        setCustomer(c); setMerchant(m);
      } else { setCustomer(null); setMerchant(null); setTxs([]); }
      setReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;
    if (merchant) return subscribeMerchantTransactions(uid, setTxs);
    if (customer) return subscribeCustomerTransactions(uid, setTxs);
  }, [uid, customer, merchant]);

  // Live balance updates for the signed-in profile.
  useEffect(() => {
    if (!uid) return;
    if (customer) {
      return onSnapshot(doc(getDb(), "customers", uid), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as any;
        setCustomer((prev) => (prev ? { ...prev, walletBalance: typeof d.wallet_balance === "number" ? d.wallet_balance : prev.walletBalance } : prev));
      });
    }
    if (merchant) {
      return onSnapshot(doc(getDb(), "merchants", uid), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as any;
        setMerchant((prev) => (prev ? { ...prev, walletBalance: typeof d.wallet_balance === "number" ? d.wallet_balance : prev.walletBalance } : prev));
      });
    }
  }, [uid, customer?.uid, merchant?.uid]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (mode === "signup") {
        if (role === "customer") {
          const { account } = await signUpCustomer(email, password, fullName, phone || undefined);
          toast.success(`تم إنشاء الحساب. رقم حسابك: ${account.accountNumber}`);
        } else {
          const { account } = await signUpMerchant(email, password, storeName, phone || undefined);
          toast.success(`تم إنشاء حساب التاجر. المعرف: ${account.merchantId}`);
        }

      } else {
        await signInEmail(email, password);
        toast.success("تم تسجيل الدخول");
      }
    } catch (e: any) { toast.error(e?.message || "فشلت العملية"); }
    finally { setLoading(false); }
  };

  const logout = async () => { await signOutUser(); };

  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast.success("تم النسخ"); }
    catch { toast.error("تعذر النسخ"); }
  };

  const submitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    const amt = parseFloat(scanAmount);
    setLoading(true);
    try {
      const id = await createMerchantTransaction(uid, scanAcct.trim(), amt);
      toast.success("تم إنشاء عملية دفع بانتظار موافقة العميل");
      setScanAcct(""); setScanAmount("");
    } catch (e: any) { toast.error(e?.message || "فشل"); }
    finally { setLoading(false); }
  };

  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md"><CardHeader><CardTitle>Firebase غير مُهيّأ</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">
          أضف مفاتيح VITE_FIREBASE_* إلى ملف .env
        </p></CardContent></Card>
      </div>
    );
  }
  if (!ready) return <div className="min-h-screen flex items-center justify-center">...</div>;

  // -------- Authed views --------
  if (uid && customer) {
    const completed = txs.filter((t) => t.status === "completed");
    return (
      <div className="min-h-screen bg-background p-6">
        <CustomerApprovalModal customerUid={uid} walletBalance={customer.walletBalance} />
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">حسابي في جوار</h1>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 ml-2" /> خروج</Button>
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-primary-foreground/90 text-sm font-normal"><Wallet className="w-4 h-4" /> رصيد المحفظة</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold" dir="ltr">{customer.walletBalance.toFixed(2)} <span className="text-lg font-normal">ر.س</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>رقم الحساب الثابت</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-2xl inline-block">
                <QRCodeSVG value={customer.accountNumber} size={240} level="M" marginSize={2} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">رقم حسابك (فريد ودائم)</p>
                <div className="flex items-center justify-center gap-2">
                  <p dir="ltr" className="font-mono font-bold text-2xl tracking-widest text-primary">{customer.accountNumber}</p>
                  <Button variant="ghost" size="icon" onClick={() => copy(customer.accountNumber)}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground text-right space-y-1">
                <p><strong>الاسم:</strong> {customer.fullName || "—"}</p>
                <p><strong>البريد:</strong> {customer.email}</p>
                <p><strong>الجوال:</strong> {customer.phone || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>عملياتي المكتملة</CardTitle></CardHeader>
            <CardContent>
              {completed.length === 0 && <p className="text-sm text-muted-foreground text-center">لا توجد عمليات مكتملة</p>}
              <ul className="space-y-2">
                {completed.map((t) => (
                  <li key={t.id} className="flex justify-between border-b pb-2 text-sm">
                    <div>
                      <p className="font-semibold">{t.amount} ر.س</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">تاجر: {t.merchant_id}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleString("ar-SA") : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  if (uid && merchant) {
    const pendingSent = txs.filter((t) => t.status === "pending");
    const completedReceived = txs.filter((t) => t.status === "completed");
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6" />{merchant.storeName || "متجري"}</h1>
              <p className="text-xs text-muted-foreground">المعرف: <span dir="ltr" className="font-mono">{merchant.merchantId}</span></p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 ml-2" /> خروج</Button>
          </div>

          <Card>
            <CardHeader><CardTitle>تحصيل دفعة</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3">
                <MerchantQRScanner onDetected={(acct) => setScanAcct(acct)} />
              </div>
              <form onSubmit={submitScan} className="space-y-3">
                <div>
                  <Label>رقم حساب العميل</Label>
                  <Input dir="ltr" value={scanAcct} onChange={(e) => setScanAcct(e.target.value)} placeholder="1000000001" required />
                </div>
                <div>
                  <Label>المبلغ (ر.س)</Label>
                  <Input dir="ltr" type="number" min="0.01" step="0.01" value={scanAmount} onChange={(e) => setScanAmount(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>إرسال طلب الدفع للعميل</Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                يُرسل الطلب فوراً للعميل لموافقته. لا يمكنك رؤية بياناته الشخصية.
              </p>
            </CardContent>
          </Card>

          {pendingSent.length > 0 && (
            <Card>
              <CardHeader><CardTitle>بانتظار موافقة العميل</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {pendingSent.map((t) => (
                    <li key={t.id} className="flex justify-between border-b pb-2 text-sm">
                      <div>
                        <p className="font-semibold">{t.amount} ر.س</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">حساب: {t.account_number}</p>
                      </div>
                      <span className="text-xs text-amber-600">قيد الانتظار</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>المدفوعات المستلمة</CardTitle></CardHeader>
            <CardContent>
              {completedReceived.length === 0 && <p className="text-sm text-muted-foreground text-center">لا توجد مدفوعات مكتملة</p>}
              <ul className="space-y-2">
                {completedReceived.map((t) => (
                  <li key={t.id} className="flex justify-between border-b pb-2 text-sm">
                    <div>
                      <p className="font-semibold">{t.amount} ر.س</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">حساب: {t.account_number}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleString("ar-SA") : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  // -------- Auth forms --------
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>{mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"} (Firebase)</CardTitle></CardHeader>
        <CardContent>
          {mode === "signup" && (
            <div className="flex gap-2 mb-4">
              <Button type="button" variant={role === "customer" ? "default" : "outline"} className="flex-1" onClick={() => setRole("customer")}>
                <UserIcon className="w-4 h-4 ml-2" /> عميل
              </Button>
              <Button type="button" variant={role === "merchant" ? "default" : "outline"} className="flex-1" onClick={() => setRole("merchant")}>
                <Store className="w-4 h-4 ml-2" /> تاجر
              </Button>
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && role === "customer" && (
              <div><Label>الاسم الكامل</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
            )}
            {mode === "signup" && role === "merchant" && (
              <div><Label>اسم المتجر</Label>
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} required /></div>
            )}
            {mode === "signup" && (
              <div><Label>الجوال</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></div>
            )}
            <div><Label>البريد الإلكتروني</Label>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>كلمة المرور</Label>
              <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "..." : mode === "signup" ? "إنشاء الحساب" : "دخول"}
            </Button>
            <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "لديك حساب؟ سجّل الدخول" : "ليس لديك حساب؟ أنشئ حساباً جديداً"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirebasePhase1;
