import { useState } from "react";
import { Copy, Hash, Calendar, Fingerprint, User as UserIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  accountNumber: string;
  linkedAt: string;
  customerId: string;
  userId: string;
}

const AccountInfoCard = ({ accountNumber, linkedAt, customerId, userId }: Props) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(`تم نسخ ${label}`);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  const formatted = new Date(linkedAt).toLocaleString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rows: Array<{ key: string; label: string; value: string; icon: React.ReactNode; mono?: boolean; copyable?: boolean; copyLabel?: string }> = [
    {
      key: "account",
      label: "رقم الحساب الثابت",
      value: accountNumber || "—",
      icon: <Hash className="w-4 h-4 text-primary" />,
      mono: true,
      copyable: !!accountNumber,
      copyLabel: "رقم الحساب",
    },
    {
      key: "linked",
      label: "تاريخ ربط الحساب",
      value: formatted,
      icon: <Calendar className="w-4 h-4 text-primary" />,
    },
    {
      key: "customerId",
      label: "المرجع داخل النظام (Customer ID)",
      value: customerId,
      icon: <Fingerprint className="w-4 h-4 text-primary" />,
      mono: true,
      copyable: true,
      copyLabel: "المعرّف",
    },
    {
      key: "userId",
      label: "معرّف المستخدم (User ID)",
      value: userId,
      icon: <UserIcon className="w-4 h-4 text-primary" />,
      mono: true,
      copyable: true,
      copyLabel: "معرّف المستخدم",
    },
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-cairo font-bold text-foreground text-lg">حسابي في جوار</h2>
        <span className="inline-flex items-center gap-1 text-xs font-ibm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          مرتبط ونشط
        </span>
      </div>

      <p className="text-xs text-muted-foreground font-ibm mb-4">
        رقم الحساب الثابت هو معرّفك الدائم في نظام جوار، يمكن للتاجر إدخاله يدوياً لاستقبال الدفعات في حال تعذّر مسح كود QR.
      </p>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.key} className="py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="mt-0.5 shrink-0">{row.icon}</div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-ibm">{row.label}</p>
                <p
                  className={`text-sm text-foreground break-all ${row.mono ? "font-mono" : "font-ibm"}`}
                >
                  {row.value}
                </p>
              </div>
            </div>
            {row.copyable && (
              <button
                onClick={() => copy(row.value, row.key, row.copyLabel || row.label)}
                className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline font-ibm"
              >
                <Copy className="w-3 h-3" />
                {copied === row.key ? "تم" : "نسخ"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountInfoCard;
