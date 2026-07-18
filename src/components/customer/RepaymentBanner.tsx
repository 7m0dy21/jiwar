import { CalendarClock } from "lucide-react";

interface Props {
  dueDate: number | null;
  amount: number;
}

const RepaymentBanner = ({ dueDate, amount }: Props) => {
  const d = dueDate ? new Date(dueDate) : null;
  const formatted = d
    ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
    : "غير محدد";

  const daysLeft = d
    ? Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-l from-primary/5 to-primary/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 rounded-xl p-2.5">
            <CalendarClock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-cairo">موعد السداد القادم</p>
            <p className="font-bold font-cairo text-lg" dir="ltr">{formatted}</p>
            {daysLeft !== null && (
              <p className="text-xs text-muted-foreground font-cairo">
                {daysLeft === 0 ? "اليوم" : `متبقي ${daysLeft} يوماً`}
              </p>
            )}
          </div>
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground font-cairo">المبلغ المستحق</p>
          <p className="text-2xl font-bold text-primary" dir="ltr">
            {amount.toFixed(2)} <span className="text-sm">ر.س</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RepaymentBanner;
