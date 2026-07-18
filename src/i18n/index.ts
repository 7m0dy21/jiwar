import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

const STORAGE_KEY = "jiwar_lang";
const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "ar";
const initialLang = stored === "en" ? "en" : "ar";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: initialLang,
    fallbackLng: "ar",
    interpolation: { escapeValue: false },
  });

export const applyLanguage = (lang: "ar" | "en") => {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === "ar" ? "rtl" : "ltr";
};

// Apply on load
applyLanguage(initialLang);

export default i18n;
