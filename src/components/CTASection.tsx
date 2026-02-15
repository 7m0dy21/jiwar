import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const CTASection = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow" />
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          className="bg-gradient-card border-glow rounded-3xl p-12 md:p-16 text-center shadow-card max-w-3xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-cairo font-bold mb-6">
            جاهز لتبدأ مع <span className="text-gradient-primary">جوار</span>؟
          </h2>
          <p className="text-muted-foreground text-lg font-ibm mb-10 max-w-xl mx-auto">
            انضم لشبكة التموينات الذكية وحوّل تجارتك إلى تجربة رقمية آمنة
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-gradient-primary text-primary-foreground font-bold text-lg px-10 py-6 rounded-xl glow-green hover:opacity-90 transition-opacity gap-2">
              ابدأ الآن مجاناً
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
