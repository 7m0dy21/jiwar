import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/config/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

interface Props {
  merchantUid: string;
  initialIban?: string;
  initialBankName?: string;
  initialHolder?: string;
}

const maskIban = (iban: string) =>
  iban.length < 8 ? iban : `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;

const BankDetailsForm = ({ merchantUid, initialIban, initialBankName, initialHolder }: Props) => {
  const [iban, setIban] = useState(initialIban ?? "");
  const [bankName, setBankName] = useState(initialBankName ?? "");
  const [holder, setHolder] = useState(initialHolder ?? "");
  const [editing, setEditing] = useState(!initialIban);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = iban.replace(/\s+/g, "").toUpperCase();
    if (!/^SA\d{22}$/.test(clean)) {
      toast.error("آيبان غير صالح - يجب أن يبدأ بـ SA ويكون 24 خانة");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(getDb(), "merchants", merchantUid), {
        iban: clean,
        bank_name: bankName || null,
        bank_holder: holder || null,
      });
      toast.success("تم حفظ الحساب البنكي");
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          الحساب البنكي (IBAN)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!editing && initialIban ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">رقم الآيبان</p>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                تعديل
              </Button>
            </div>
            <p className="font-mono font-bold text-lg" dir="ltr">{maskIban(initialIban)}</p>
            {initialBankName && (
              <p className="text-sm text-muted-foreground">
                البنك: <span className="font-semibold">{initialBankName}</span>
              </p>
            )}
            {initialHolder && (
              <p className="text-sm text-muted-foreground">
                صاحب الحساب: <span className="font-semibold">{initialHolder}</span>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label>رقم الآيبان (IBAN)</Label>
              <Input
                dir="ltr"
                placeholder="SA0000000000000000000000"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                maxLength={30}
                required
              />
            </div>
            <div>
              <Label>اسم البنك</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <Label>اسم صاحب الحساب</Label>
              <Input value={holder} onChange={(e) => setHolder(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1">
                حفظ
              </Button>
              {initialIban && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setIban(initialIban);
                  }}
                >
                  إلغاء
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default BankDetailsForm;
