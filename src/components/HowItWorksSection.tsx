import { motion } from "framer-motion";
import { UserPlus, ScanLine, ShoppingBag, ArrowDownToLine } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "١",
    title: "التسجيل والتوثيق",
    description: "سجّل حسابك ووثّق هويتك عبر نفاذ ووقّع السند الإلكتروني",
  },
  {
    icon: ShoppingBag,
    number: "٢",
    title: "تسوّق من التموينات",
    description: "اختر أغراضك من أي تموينات مشتركة في جوار بحيّك",
  },
  {
    icon: ScanLine,
    number: "٣",
    title: "امسح وادفع",
    description: "افتح التطبيق واعرض كود QR الخاص بك للتاجر ليؤكد المبلغ",
  },
  {
    icon: ArrowDownToLine,
    number: "٤",
    title: "سدّد نهاية الشهر",
    description: "التاجر يستلم مبلغه فوراً وأنت تسدد لجوار في نهاية الشهر",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-24 bg-muted/30" id="how-it-works">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-cairo font-bold mb-4">
            كيف <span className="text-gradient-primary">يعمل</span>؟
          </h2>
          <p className="text-muted-foreground text-lg font-ibm">أربع خطوات بسيطة فقط</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 -left-4 w-8 h-0.5 bg-primary/30" />
              )}

              <div className="w-24 h-24 rounded-2xl bg-gradient-card border-glow mx-auto mb-6 flex items-center justify-center relative shadow-card">
                <step.icon className="w-10 h-10 text-primary" />
                <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-primary text-primary-foreground font-cairo font-bold text-sm flex items-center justify-center">
                  {step.number}
                </span>
              </div>
              <h3 className="text-lg font-cairo font-bold text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground font-ibm text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
