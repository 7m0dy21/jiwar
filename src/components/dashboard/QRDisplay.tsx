import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

interface QRDisplayProps {
  qrCode: string;
  name: string;
}

const QRDisplay = ({ qrCode, name }: QRDisplayProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/5">
          <QrCode className="w-5 h-5 ml-2 text-primary" />
          عرض كود الدفع
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="font-cairo text-xl">كود الدفع الخاص بك</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="bg-white p-6 rounded-2xl">
            <QRCodeSVG value={qrCode} size={200} level="H" />
          </div>
          <p className="font-cairo font-bold text-foreground text-lg">{name}</p>
          <p className="text-xs text-muted-foreground font-ibm">أظهر هذا الكود للتاجر عند الدفع</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRDisplay;
