import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, LogOut, Store, Wallet } from "lucide-react";
import {
  createMerchantTransaction,
  subscribeCustomerTransactions,
  subscribeMerchantTransactions,
  type TransactionRecord,
} from "@/lib/firebaseTransactions";
import { setCustomerVerified, type CustomerAccount } from "@/lib/firebaseCustomers";
import type { MerchantAccount } from "@/lib/firebaseMerchants";
import MerchantQRScanner from "@/components/firebase/MerchantQRScanner";
import CustomerApprovalModal from "@/components/firebase/CustomerApprovalModal";

const Dashboard = () => {
  const { user, loading, role, signOut } = useAuth();
  const uid = user?.uid ?? null;
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [merchant, setMerchant] = useState<MerchantAccount | null>(null);
  const [txs, setTxs] = useState<TransactionRecord[]>([]);
  const [scanAcct, setScanAcct] = useState("");
  const [scanAmount, setScanAmount] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsubC = onSnapshot(doc(getDb(), "customers", uid), (s) => {
      if (!s.exists()) { setCustomer(null); return; }
      const d = s.data() as any;
      setCustomer({
        uid, accountNumber: d.account_number ?? "", fullName: d.full_name ?? "",
        phone: d.phone ?? null, email: d.email ?? "",
        walletBalance: typeof d.wallet_balance === "number" ? d.wallet_balance : 0,
        isVerified: d.is_verified === true,
        createdAt: d.created_at?.toMillis?.() ?? null,
      });
    });
    const unsubM = onSnapshot(doc(getDb(), "merchants", uid), (s) => {
      if (!s.exists()) { setMerchant(null); return; }
      const d = s.data() as any;
      setMerchant({
        uid, merchantId: d.merchant_id ?? "", storeName: d.store_name ?? "",
        phone: d.phone ?? null, email: d.email ?? "",
        walletBalance: typeof d.wallet_balance === "number" ? d.wallet_balance : 0,
        createdAt: d.created_at?.toMillis?.() ?? null,
      });
    });
    return () => { unsubC(); unsubM(); };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    if (merchant) return subscribeMerchantTransactions(uid, setTxs);
    if (customer) return subscribeCustomerTransactions(uid, setTxs);
  }, [uid, customer, merchant]);

  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast.success("تم النسخ"); }
    catch { toast.error("تعذر النسخ"); }
  };

  const submitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    const amt = parseFloat(scanAmount);
    setSending(true);
    try {
      await createMerchantTransaction(uid, scanAcct.trim(), amt);
      toast.success("تم إرسال طلب الدفع بانتظار موافقة العميل");
      setScanAcct(""); setScanAmount("");
    } catch (e: any) { toast.error(e?.message || "فشل"); }
    finally { setSending(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-cairo">جارٍ التحميل...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;

  // Customer view
  if (customer) {
    const completed = txs.filter((t) => t.status === "completed");
    return (
      <div className="min-h-screen bg-background p-6">
        <CustomerApprovalModal customerUid={uid!} walletBalance={customer.walletBalance} isVerified={customer.isVerified} />
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-cairo font-bold">حسابي في جوار</h1>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 ml-2" /> خروج</Button>
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-primary-foreground/90 text-sm font-normal"><Wallet className="w-4 h-4" /> رصيد المحفظة</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold" dir="ltr">{customer.walletBalance.toFixed(2)} <span className="text-lg font-normal">ر.س</span></p>
            </CardContent>
          </Card>

          <Card className={customer.isVerified ? "border-primary/40" : "border-destructive/40"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal flex items-center justify-between">
                <span>حالة التحقق (نفاذ)</span>
                <span className={customer.isVerified ? "text-primary font-bold" : "text-destructive font-bold"}>
                  {customer.isVerified ? "موثّق ✓" : "غير موثّق"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {customer.isVerified ? "حسابك موثّق ويمكنك استقبال طلبات الدفع." : "لن تستطيع الموافقة على أي عملية دفع حتى يتم توثيق الحساب."}
              </p>
              <Button size="sm" variant={customer.isVerified ? "outline" : "default"} className="w-full"
                onClick={async () => {
                  try { await setCustomerVerified(uid!, !customer.isVerified);
                    toast.success(customer.isVerified ? "تم إلغاء التوثيق" : "تم توثيق الحساب");
                  } catch (e: any) { toast.error(e?.message || "فشل التحديث"); }
                }}>
                {customer.isVerified ? "إلغاء التوثيق (Admin)" : "توثيق الحساب (Admin/Nafath)"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>رقم الحساب الثابت</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-2xl inline-block min-h-[272px] min-w-[272px] flex items-center justify-center">
                {customer.accountNumber
                  ? <QRCodeSVG value={customer.accountNumber} size={240} level="M" marginSize={2} />
                  : <span className="text-muted-foreground text-sm">جارٍ التحميل...</span>}
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

  // Merchant view
  if (merchant) {
    const pendingSent = txs.filter((t) => t.status === "pending");
    const completedReceived = txs.filter((t) => t.status === "completed");
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-cairo font-bold flex items-center gap-2"><Store className="w-6 h-6" />{merchant.storeName || "متجري"}</h1>
              <p className="text-xs text-muted-foreground">المعرف: <span dir="ltr" className="font-mono">{merchant.merchantId}</span></p>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 ml-2" /> خروج</Button>
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-primary-foreground/90 text-sm font-normal"><Wallet className="w-4 h-4" /> رصيد المحفظة</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold" dir="ltr">{merchant.walletBalance.toFixed(2)} <span className="text-lg font-normal">ر.س</span></p>
            </CardContent>
          </Card>

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
                <Button type="submit" className="w-full" disabled={sending}>إرسال طلب الدفع للعميل</Button>
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

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-cairo">جارٍ تحميل بيانات الحساب...</div>;
};

export default Dashboard;
