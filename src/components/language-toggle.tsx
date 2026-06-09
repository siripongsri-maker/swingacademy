import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export function LanguageToggle({
  variant = "light",
  className = "",
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const { lang, toggle } = useLanguage();
  const isDark = variant === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle language"
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-medium transition-all ${
        isDark
          ? "border border-white/15 bg-white/5 text-white hover:bg-white/10"
          : "border border-warm-300 bg-white text-navy-500 hover:border-magenta-500 hover:text-magenta-500"
      } ${className}`}
    >
      <Languages className="h-4 w-4" />
      <span className={lang === "th" ? "text-magenta-500" : ""}>ไทย</span>
      <span className={isDark ? "text-white/40" : "text-warm-300"}>/</span>
      <span className={lang === "en" ? "text-magenta-500" : ""}>EN</span>
    </button>
  );
}
