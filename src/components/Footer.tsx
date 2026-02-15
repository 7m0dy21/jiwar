import jiwarLogo from "@/assets/jiwar-logo.png";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12 bg-muted/20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={jiwarLogo} alt="جوار" className="w-12 h-12 object-contain" />
            <div>
              <p className="font-cairo font-bold text-foreground">جوار</p>
              <p className="text-sm text-muted-foreground font-ibm">رقمنة الثقة.. وتأمين التدفقات</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-ibm">
            © ٢٠٢٦ جوار. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
