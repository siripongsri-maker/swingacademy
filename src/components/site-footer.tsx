import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useLanguage, type Localized } from "@/lib/language-context";
import { BrandLogo } from "@/components/brand-logo";

const QUICK_LINKS: { to: string; label: Localized }[] = [
  { to: "/courses", label: { th: "คอร์สทั้งหมด", en: "All courses" } },
  { to: "/paths", label: { th: "เส้นทางเรียนรู้", en: "Learning paths" } },
  { to: "/knowledge", label: { th: "คลังความรู้", en: "Knowledge library" } },
  { to: "/resources", label: { th: "คลังทรัพยากร", en: "Resources" } },
  { to: "/verify", label: { th: "ตรวจสอบใบประกาศ", en: "Verify certificate" } },
];

const PARTNERS = ["EpiC", "PEPFAR", "NHSO", "UNAIDS", "APCOM"];

export function SiteFooter({ flush = false }: { flush?: boolean }) {
  const { t, lang } = useLanguage();

  return (
    <footer className={`${flush ? "" : "mt-20 "}border-t border-warm-200 bg-white`}>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="SWING Academy หน้าแรก"
          >
            <BrandLogo size={44} />
          </Link>
          <p lang={lang} className="mt-4 max-w-md text-sm text-warm-600">
            {t({
              th: "โดยมูลนิธิเพื่อนพนักงานบริการ (SWING) พื้นที่เรียนรู้ที่ทำกับชุมชน เพื่อชุมชน",
              en: "By the SWING Foundation. A learning space built with and for our community.",
            })}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-pill bg-lavender-100 px-3.5 py-1.5 text-xs font-medium text-navy-500">
            <Shield className="h-3.5 w-3.5 text-lavender-700" />
            <span lang={lang}>
              {t({
                th: "การเรียนรู้ฟรี เป็นความลับ และเคารพทุกคน",
                en: "Free, private, and respectful learning for our community",
              })}
            </span>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-3">{t({ th: "ทางลัด", en: "Quick links" })}</p>
          <ul className="space-y-0.5">
            {QUICK_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-flex min-h-9 items-center text-sm text-navy-500/80 transition-colors hover:text-magenta-500"
                >
                  {t(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-3">{t({ th: "พันธมิตร", en: "Partners" })}</p>
          <div className="flex flex-wrap gap-2">
            {PARTNERS.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-md border border-warm-200 bg-cream px-2.5 py-1 text-xs font-medium text-warm-700"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-warm-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-xs text-warm-500 md:flex-row md:items-center md:justify-between">
          <p lang={lang}>
            {t({
              th: "© SWING Foundation · ทุกคนยินดีต้อนรับเสมอ",
              en: "© SWING Foundation · Everyone is welcome here",
            })}
          </p>
          <div className="pride-gradient h-1 w-32 rounded-pill" aria-hidden />
        </div>
      </div>
    </footer>
  );
}
