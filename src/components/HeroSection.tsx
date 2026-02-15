import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import jiwarLogo from "@/assets/jiwar-logo.png";
import heroBg from "@/assets/hero-bg.jpg";
import { ShieldCheck, QrCode, CreditCard } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover opacity-15" />
        <div className="absolute inset-0 bg-gradient-hero" />
      </div>

      {/* Glow effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-glow animate-pulse-glow" />

      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-8"
        >
          {/* Logo */}
          <motion.img
            src={jiwarLogo}
            alt="جوار - Jiwar"
            className="w-48 md:w-64 animate-float drop-shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          />

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-cairo font-bold leading-tight">
            <span className="text-foreground">اشترِ الآن</span>
            <br />
            <span className="text-gradient-primary">وادفع لاحقاً</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl font-ibm leading-relaxed">
            منصة تقنية مالية تُحوّل نظام الائتمان التقليدي في تموينات الأحياء إلى تجربة رقمية آمنة ومحمية قانونياً
          </p>

          {/* Key highlights */}
          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {[
              { icon: ShieldCheck, text: "حماية قانونية كاملة" },
              { icon: QrCode, text: "دفع بمسح الكود" },
              { icon: CreditCard, text: "تسوية فورية للتاجر" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.15 }}
                className="flex items-center gap-2 bg-card border-glow rounded-full px-5 py-2.5 text-sm text-foreground shadow-sm"
              >
                <item.icon className="w-4 h-4 text-primary" />
                <span>{item.text}</span>
              </motion.div>
            ))}
          </div>

          {/* CTAs */}
          <motion.div
            className="flex flex-wrap justify-center gap-4 mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <Button size="lg" className="bg-gradient-primary text-primary-foreground font-bold text-lg px-8 py-6 rounded-xl glow-green hover:opacity-90 transition-opacity">
              سجّل كتاجر
            </Button>
            <Button size="lg" variant="outline" className="border-primary/40 text-foreground font-bold text-lg px-8 py-6 rounded-xl hover:bg-primary/10 transition-colors">
              احصل على حد ائتماني
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;
