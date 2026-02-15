import { motion } from "framer-motion";
import { ShieldCheck, QrCode, Wallet, BadgeCheck, FileText, Smartphone } from "lucide-react";

const features = [
  {
    icon: BadgeCheck,
    title: "التحقق عبر نفاذ",
    description: "توثيق الهوية الوطنية أو الإقامة إلكترونياً لضمان أمان المعاملات",
  },
  {
    icon: ShieldCheck,
    title: "فحص ائتماني آلي",
    description: "ربط مباشر مع سمة (SIMAH) لتقييم الملاءة المالية وتحديد الحد الائتماني",
  },
  {
    icon: FileText,
    title: "سند لأمر إلكتروني",
    description: "إصدار تلقائي عبر منصة نافذ لحماية حقوق التاجر قانونياً",
  },
  {
    icon: QrCode,
    title: "مسح QR فوري",
    description: "كود فريد لكل عميل يمسحه التاجر بضغطة واحدة لإتمام الشراء",
  },
  {
    icon: Wallet,
    title: "محفظة رقمية",
    description: "تتبع الرصيد المتاح والمبالغ المستحقة وتواريخ السداد بسهولة",
  },
  {
    icon: Smartphone,
    title: "سداد مرن",
    description: "دعم مدى وApple Pay لتسديد المديونية في نهاية كل شهر",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 relative" id="features">
      <div className="absolute inset-0 bg-gradient-glow opacity-30" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-cairo font-bold mb-4">
            لماذا <span className="text-gradient-primary">جوار</span>؟
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto font-ibm">
            حلول متكاملة تحمي التاجر وتخدم العميل
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-gradient-card border-glow rounded-2xl p-8 shadow-card hover:scale-[1.02] transition-transform duration-300 group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:glow-green transition-shadow">
                <feature.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-cairo font-bold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground font-ibm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
