import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { doc, onSnapshot } from "firebase/firestore";
import { useTranslation } from "react-i18next";
import { getDb } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, LogOut, Store, Wallet, ShieldCheck } from "lucide-react";
import {
  createMerchantTransaction,
  subscribeCustomerTransactions,
  subscribeMerchantTransactions,
  type TransactionRecord,
} from "@/lib/firebaseTransactions";
import { setCustomerVerified, type CustomerAccount } from "@/lib/firebaseCustomers";
import MerchantQRScanner from "@/components/firebase/MerchantQRScanner";
import CustomerApprovalModal from "@/components/firebase/CustomerApprovalModal";
import NotificationsBell from "@/components/customer/NotificationsBell";
import NearbyStores from "@/components/customer/NearbyStores";
import RepaymentBanner from "@/components/customer/RepaymentBanner";
import StoreStatusBadge, { getMerchantStatus } from "@/components/merchant/StoreStatusBadge";
import SettlementsLog from "@/components/merchant/SettlementsLog";
import BankDetailsForm from "@/components/merchant/BankDetailsForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { pushNotification } from "@/lib/firebaseNotifications";
import { playNotificationSound } from "@/lib/notificationSound";

interface MerchantView {
  uid: string; merchantId: string; storeName: string; email: string;
  phone: string | null; walletBalance: number; isVerified: boolean; isFrozen: boolean;
  receivingLimit: number; iban: string | null; bankName: string | null; bankHolder: string | null;
  createdAt: number | null;
}
interface CustomerView extends CustomerAccount { paymentLimit: number; debtDueDate: number | null; isFrozen: boolean; }

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, loading, role, signOut } = useAuth();
  const uid = user?.uid ?? null;
  const [customer, setCustomer] = useState<CustomerView | null>(null);
  const [merchant, setMerchant] = useState<MerchantView | null>(null);
  const [txs, setTxs] = useState<TransactionRecord[]>([]);
  const [scanAcct, setScanAcct] = useState("");
  const [scanAmount, setScanAmount] = useState("");
  const [sending, setSending] = useState(false);
  const seenTxIds = useRef<Set<string>>(new Set());
  const firstTxLoad = useRef(true);

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
        isFrozen: d.is_frozen === true,
        paymentLimit: typeof d.payment_limit === "number" ? d.payment_limit : 5000,
        debtDueDate: d.debt_due_date?.toMillis?.() ?? (typeof d.debt_due_date === "number" ? d.debt_due_date : null),
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
        isVerified: d.is_verified === true,
        isFrozen: d.is_frozen === true,
        receivingLimit: typeof d.receiving_limit === "number" ? d.receiving_limit : 5000,
        iban: d.iban ?? null, bankName: d.bank_name ?? null, bankHolder: d.bank_holder ?? null,
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

  // Sound + notification when a merchant receives a NEW completed payment
  useEffect(() => {
    if (!merchant || !uid) return;
    if (firstTxLoad.current) {
      txs.forEach((t) => seenTxIds.current.add(t.id + t.status));
      firstTxLoad.current = false;
      return;
    }
    txs.forEach((t) => {
      const key = t.id + t.status;
      if (!seenTxIds.current.has(key)) {
        seenTxIds.current.add(key);
        if (t.status === "completed") {
          playNotificationSound();
          toast.success(`تم استلام دفعة: ${t.amount.toFixed(2)} ر.س`);
          pushNotification(uid, {
            title: "دفعة جديدة",
            body: `استلمت ${t.amount.toFixed(2)} ر.س من حساب ${t.account_number}`,
            type: "payment",
          }).catch(() => {});
        }
      }
    });
  }, [txs, merchant, uid]);

  // Deduction notification for customer
  useEffect(() => {
    if (!customer || !uid) return;
    if (firstTxLoad.current) {
      txs.forEach((t) => seenTxIds.current.add(t.id + t.status));
      firstTxLoad.current = false;
      return;
    }
    txs.forEach((t) => {
      const key = t.id + t.status;
      if (!seenTxIds.current.has(key)) {
        seenTxIds.current.add(key);
        if (t.status === "completed") {
          pushNotification(uid, {
            title: "خصم من محفظتك",
            body: `تم خصم ${t.amount.toFixed(2)} ر.س لصالح التاجر ${t.merchant_id}`,
            type: "deduction",
          }).catch(() => {});
        }
      }
    });
  }, [txs, customer, uid]);

  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast.success("تم النسخ"); }
    catch { toast.error("تعذر النسخ"); }
  };

  const submitScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    const amt = parseFloat(scanAmount);
    if (merchant?.isFrozen) { toast.error("متجرك موقوف حالياً"); return; }
    if (merchant && amt > merchant.receivingLimit) {
      toast.error(`المبلغ يتجاوز حد الاستقبال: ${merchant.receivingLimit} ر.س`); return;
    }
    setSending(true);
    try {
      await createMerchantTransaction(uid, scanAcct.trim(), amt);
      toast.success("تم إرسال طلب الدفع بانتظار موافقة العميل");
      setScanAcct(""); setScanAmount("");
    } catch (e: any) { toast.error(e?.message || "فشل"); }
    finally { setSending(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-cairo">{t("common.loading")}</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;

  // ============ CUSTOMER VIEW ============
  if (customer) {
    const completed = txs.filter((t) => t.status === "completed");
    const outstanding = completed.reduce((s, t) => s + t.amount, 0);
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <CustomerApprovalModal customerUid={uid!} walletBalance={customer.walletBalance} isVerified={customer.isVerified && !customer.isFrozen} />
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-cairo font-bold">{t("customer.title")}</h1>
              <p className="text-xs text-muted-foreground">{customer.fullName || customer.email}</p>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <NotificationsBell userUid={uid!} />
              <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 ms-2" /> {t("common.logout")}</Button>
            </div>
          </div>

          {customer.isFrozen && (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive rounded-xl p-3 text-sm font-cairo">
              {t("customer.frozenBanner")}
            </div>
          )}

          <RepaymentBanner dueDate={customer.debtDueDate} amount={outstanding} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-primary text-primary-foreground">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-primary-foreground/90 text-sm font-normal"><Wallet className="w-4 h-4" /> {t("customer.walletBalance")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" dir="ltr">{customer.walletBalance.toFixed(2)} <span className="text-base font-normal">{t("common.sar")}</span></p>
                <p className="text-xs opacity-80 mt-2">{t("customer.paymentLimit")}: {customer.paymentLimit.toFixed(0)} {t("common.sar")}</p>
              </CardContent>
            </Card>

            <Card className={customer.isVerified ? "border-primary/40" : "border-destructive/40"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal flex items-center justify-between">
                  <span>{t("customer.verificationStatus")}</span>
                  <span className={customer.isVerified ? "text-primary font-bold" : "text-destructive font-bold"}>
                    {customer.isVerified ? t("customer.verified") : t("customer.notVerified")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {customer.isVerified ? t("customer.verifiedHelp") : t("customer.notVerifiedHelp")}
                </p>
                <Button size="sm" variant={customer.isVerified ? "outline" : "default"} className="w-full"
                  onClick={async () => {
                    try { await setCustomerVerified(uid!, !customer.isVerified);
                      toast.success(customer.isVerified ? "تم إلغاء التوثيق" : "تم توثيق الحساب");
                    } catch (e: any) { toast.error(e?.message || "فشل التحديث"); }
                  }}>
                  {customer.isVerified ? t("customer.unverify") : t("customer.verifyAccount")}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("customer.accountNumber")}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-2xl inline-block min-h-[272px] min-w-[272px] flex items-center justify-center">
                {customer.accountNumber
                  ? <QRCodeSVG value={customer.accountNumber} size={240} level="M" marginSize={2} />
                  : <span className="text-muted-foreground text-sm">{t("common.loading")}</span>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("customer.accountHint")}</p>
                <div className="flex items-center justify-center gap-2">
                  <p dir="ltr" className="font-mono font-bold text-2xl tracking-widest text-primary">{customer.accountNumber}</p>
                  <Button variant="ghost" size="icon" onClick={() => copy(customer.accountNumber)}><Copy className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <NearbyStores />

          <Card>
            <CardHeader><CardTitle>{t("customer.paymentsHistory")}</CardTitle></CardHeader>
            <CardContent>
              {completed.length === 0 && <p className="text-sm text-muted-foreground text-center">{t("customer.noPayments")}</p>}
              <ul className="space-y-2">
                {completed.map((t) => (
                  <li key={t.id} className="flex justify-between border-b pb-2 text-sm">
                    <div>
                      <p className="font-semibold text-destructive" dir="ltr">- {t.amount.toFixed(2)} ر.س</p>
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

  // ============ MERCHANT VIEW ============
  if (merchant) {
    const pendingSent = txs.filter((t) => t.status === "pending");
    const completedReceived = txs.filter((t) => t.status === "completed");
    const status = getMerchantStatus({ is_verified: merchant.isVerified, is_frozen: merchant.isFrozen });
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-cairo font-bold flex items-center gap-2"><Store className="w-6 h-6" />{merchant.storeName || t("merchant.myStore")}</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">{t("merchant.merchantId")}: <span dir="ltr" className="font-mono">{merchant.merchantId}</span></p>
                <StoreStatusBadge status={status} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <NotificationsBell userUid={uid!} />
              <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 ms-2" /> {t("common.logout")}</Button>
            </div>
          </div>

          {merchant.isFrozen && (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive rounded-xl p-3 text-sm font-cairo">
              {t("merchant.frozenBanner")}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-primary text-primary-foreground">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-primary-foreground/90 text-sm font-normal"><Wallet className="w-4 h-4" /> {t("merchant.walletBalance")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold" dir="ltr">{merchant.walletBalance.toFixed(2)} <span className="text-base font-normal">{t("common.sar")}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-normal"><ShieldCheck className="w-4 h-4 text-primary" /> {t("merchant.receivingLimit")}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary" dir="ltr">{merchant.receivingLimit.toFixed(0)} <span className="text-base text-muted-foreground">{t("common.sar")}</span></p>
                <p className="text-xs text-muted-foreground mt-2">{t("merchant.receivingLimitHint")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{t("merchant.collectPayment")}</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3">
                <MerchantQRScanner onDetected={(acct) => setScanAcct(acct)} />
              </div>
              <form onSubmit={submitScan} className="space-y-3">
                <div>
                  <Label>{t("merchant.customerAccount")}</Label>
                  <Input dir="ltr" value={scanAcct} onChange={(e) => setScanAcct(e.target.value)} placeholder="1000000001" required />
                </div>
                <div>
                  <Label>{t("merchant.amount")}</Label>
                  <Input dir="ltr" type="number" min="0.01" step="0.01" value={scanAmount} onChange={(e) => setScanAmount(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={sending || merchant.isFrozen}>{t("merchant.sendRequest")}</Button>
              </form>
            </CardContent>
          </Card>

          <Tabs defaultValue="payments">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="payments">{t("merchant.tabs.payments")}</TabsTrigger>
              <TabsTrigger value="settlements">{t("merchant.tabs.settlements")}</TabsTrigger>
              <TabsTrigger value="bank">{t("merchant.tabs.bank")}</TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="space-y-4 mt-4">
              {pendingSent.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>{t("merchant.pendingApproval")}</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {pendingSent.map((tx) => (
                        <li key={tx.id} className="flex justify-between border-b pb-2 text-sm">
                          <div>
                            <p className="font-semibold">{tx.amount} {t("common.sar")}</p>
                            <p className="text-xs text-muted-foreground" dir="ltr">{tx.account_number}</p>
                          </div>
                          <span className="text-xs text-amber-600">{t("merchant.pending")}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle>{t("merchant.receivedPayments")}</CardTitle></CardHeader>
                <CardContent>
                  {completedReceived.length === 0 && <p className="text-sm text-muted-foreground text-center">{t("merchant.noPayments")}</p>}
                  <ul className="space-y-2">
                    {completedReceived.map((t) => (
                      <li key={t.id} className="flex justify-between border-b pb-2 text-sm">
                        <div>
                          <p className="font-semibold text-primary" dir="ltr">+ {t.amount.toFixed(2)} ر.س</p>
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
            </TabsContent>

            <TabsContent value="settlements" className="mt-4">
              <SettlementsLog merchantUid={uid!} />
            </TabsContent>

            <TabsContent value="bank" className="mt-4">
              <BankDetailsForm
                merchantUid={uid!}
                initialIban={merchant.iban ?? undefined}
                initialBankName={merchant.bankName ?? undefined}
                initialHolder={merchant.bankHolder ?? undefined}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center text-muted-foreground font-cairo">{t("common.loading")}</div>;
};

export default Dashboard;
