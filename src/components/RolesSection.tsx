import { motion } from "framer-motion";
import { Store, User, Settings } from "lucide-react";

const roles = [
  {
    icon: Store,
    title: "التاجر",
    features: [
      "استلام المستحقات فوراً",
      "لوحة تحكم لمتابعة المبيعات",
      "حماية قانونية بسند لأمر",
      "مسح QR سريع بضغطة واحدة",
    ],
  },
  {
    icon: User,
    title: "العميل",
    features: [
      "حد ائتماني يصل إلى 500 ريال",
      "تسوّق بدون كاش",
      "سداد مرن نهاية الشهر",
      "محفظة رقمية لتتبع المصاريف",
    ],
  },
  {
    icon: Settings,
    title: "المسؤول",
    features: [
      "لوحة تحكم شاملة",
      "إدارة المخاطر والتحصيل",
      "ربط مع الجهات الحكومية",
      "تقارير وإحصائيات متقدمة",
    ],
  },
];

const RolesSection = () => {
  return (
    <section className="py-24" id="roles">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-cairo font-bold mb-4">
            مصمم <span className="text-gradient-primary">للجميع</span>
          </h2>
          <p className="text-muted-foreground text-lg font-ibm">تجربة مخصصة لكل دور</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {roles.map((role, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`bg-gradient-card border-glow rounded-2xl p-8 shadow-card ${i === 0 ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <role.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-cairo font-bold text-foreground">{role.title}</h3>
              </div>
              {i === 0 && (
                <span className="inline-block mb-4 px-3 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary font-cairo">
                  الأكثر طلباً
                </span>
              )}
              <ul className="space-y-3">
                {role.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-3 text-muted-foreground font-ibm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RolesSection;
