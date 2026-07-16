import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, MapPin, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Merchant {
  id: string;
  store_name: string;
  store_address: string | null;
  is_active: boolean;
}

const NearbyMerchants = () => {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMerchants = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("merchants_public")
        .select("id, store_name, store_address, is_active")
        .order("store_name");
      setMerchants(data || []);
      setLoading(false);
    };
    fetchMerchants();
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
        <h2 className="font-cairo font-bold text-foreground text-lg mb-4 flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          التموينات المعتمدة
        </h2>
        <p className="text-muted-foreground font-ibm text-sm">جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <h2 className="font-cairo font-bold text-foreground text-lg mb-4 flex items-center gap-2">
        <Store className="w-5 h-5 text-primary" />
        التموينات المعتمدة القريبة
      </h2>

      {merchants.length === 0 ? (
        <div className="text-center py-8">
          <Store className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-ibm text-sm">لا توجد تموينات معتمدة حالياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {merchants.map((merchant) => (
            <div
              key={merchant.id}
              className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-cairo font-bold text-foreground truncate">
                    {merchant.store_name}
                  </p>
                  <Badge variant="secondary" className="text-xs shrink-0 gap-1">
                    <CheckCircle className="w-3 h-3" />
                    معتمد
                  </Badge>
                </div>
                {merchant.store_address && (
                  <p className="text-sm text-muted-foreground font-ibm flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {merchant.store_address}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NearbyMerchants;
