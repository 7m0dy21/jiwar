import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, Ban } from "lucide-react";

export type MerchantStatus = "verified" | "under_review" | "frozen";

export const getMerchantStatus = (m: {
  is_verified?: boolean;
  is_frozen?: boolean;
  status?: string;
}): MerchantStatus => {
  if (m.is_frozen || m.status === "frozen") return "frozen";
  if (m.is_verified) return "verified";
  return "under_review";
};

const map = {
  verified: { label: "متجر موثّق", icon: ShieldCheck, cls: "bg-primary text-primary-foreground" },
  under_review: { label: "قيد المراجعة", icon: Clock, cls: "bg-amber-500 text-white" },
  frozen: { label: "مجمّد / موقوف", icon: Ban, cls: "bg-destructive text-destructive-foreground" },
};

const StoreStatusBadge = ({ status }: { status: MerchantStatus }) => {
  const c = map[status];
  const Icon = c.icon;
  return (
    <Badge className={`${c.cls} gap-1 font-cairo`}>
      <Icon className="w-3 h-3" /> {c.label}
    </Badge>
  );
};

export default StoreStatusBadge;
