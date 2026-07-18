import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyLanguage } from "@/i18n";

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const current = i18n.language === "en" ? "en" : "ar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("common.language")}>
          <Globe className="w-4 h-4" />
          <span className="ms-1 text-xs font-semibold uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => applyLanguage("ar")}>
          🇸🇦 {t("common.arabic")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyLanguage("en")}>
          🇬🇧 {t("common.english")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
