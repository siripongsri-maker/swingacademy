import { Link } from "@tanstack/react-router";
import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export function SiteHeader() {
  const { lang, toggle, t } = useLanguage();

  const nav = [
    { to: "/", label: { th: "หน้าแรก", en: "Home" } },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-warm-200 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-magenta-500 text-white font-bold">
            S
          </span>
          <span className="text-lg font-semibold text-navy-500">
            SWING <span className="text-magenta-500">Academy</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-navy-500/80 transition-colors hover:text-magenta-500"
              activeProps={{ className: "text-magenta-500" }}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle language"
          className="inline-flex items-center gap-2 rounded-pill border border-warm-300 bg-white px-3.5 py-1.5 text-sm font-medium text-navy-500 transition-all hover:border-magenta-500 hover:text-magenta-500"
        >
          <Languages className="h-4 w-4" />
          <span className={lang === "th" ? "text-magenta-500" : ""}>ไทย</span>
          <span className="text-warm-300">/</span>
          <span className={lang === "en" ? "text-magenta-500" : ""}>EN</span>
        </button>
      </div>
    </header>
  );
}
