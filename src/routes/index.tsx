import { createFileRoute } from "@tanstack/react-router";
import { Heart, Scale, Sparkles, Sun, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  heart: Heart,
  scale: Scale,
  sparkles: Sparkles,
  sun: Sun,
};

type Category = {
  id: string;
  icon: string;
  color: string;
  name: Localized;
  blurb: Localized;
};

function HomePage() {
  const { t, lang } = useLanguage();
  const categories = seed.publicPortal.categories as Category[];

  const hero = {
    eyebrow: { th: "ยินดีต้อนรับสู่ SWING Academy", en: "Welcome to SWING Academy" },
    title: {
      th: "เรียนรู้ ดูแลตัวเอง\nและเคารพในสิทธิ์ของเรา",
      en: "Learn, care for yourself,\nand know your rights.",
    },
    sub: {
      th: "พื้นที่เรียนรู้ฟรี อบอุ่น และเป็นมิตร สำหรับชุมชนของเรา — สุขภาพทางเพศ สิทธิ ทักษะชีวิต และการดูแลใจ",
      en: "A free, warm, judgement-free learning space for our communities — sexual health, rights, life skills, and wellbeing.",
    },
    cta: { th: "เริ่มเรียนเลย", en: "Start learning" },
    ctaAlt: { th: "ทำความรู้จักเรา", en: "About us" },
  };

  return (
    <PublicLayout>
      <div>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-magenta-100 blur-3xl opacity-60"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-lavender-100 blur-3xl opacity-70"
          />

          <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
            <p className="eyebrow mb-5">{t(hero.eyebrow)}</p>
            <h1
              lang={lang}
              className="max-w-3xl whitespace-pre-line text-4xl font-semibold text-navy-500 md:text-6xl"
            >
              {t(hero.title)}
            </h1>
            <p
              lang={lang}
              className="mt-6 max-w-2xl text-lg text-warm-500"
            >
              {t(hero.sub)}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700">
                {t(hero.cta)}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-pill border border-navy-300 bg-white px-6 py-3 text-sm font-semibold text-navy-500 transition-all hover:border-navy-500">
                {t(hero.ctaAlt)}
              </button>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3">
                {t({ th: "หมวดหมู่การเรียนรู้", en: "Learning paths" })}
              </p>
              <h2 lang={lang} className="text-3xl font-semibold text-navy-500 md:text-4xl">
                {t({ th: "เริ่มจากสิ่งที่อยากรู้", en: "Start with what matters to you" })}
              </h2>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => {
              const Icon = ICONS[cat.icon] ?? Sparkles;
              return (
                <article
                  key={cat.id}
                  className="group rounded-md border border-warm-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)" }}
                >
                  <div
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${cat.color}1A`, color: cat.color }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 lang={lang} className="text-lg font-semibold text-navy-500">
                    {t(cat.name)}
                  </h3>
                  <p lang={lang} className="mt-2 text-sm text-warm-500">
                    {t(cat.blurb)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Footer strip */}
        <footer className="border-t border-warm-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-warm-500 md:flex-row md:items-center md:justify-between">
            <p lang={lang}>
              {t({
                th: "© SWING Foundation — พื้นที่ปลอดภัยและเป็นมิตรสำหรับทุกคน",
                en: "© SWING Foundation — a safe, welcoming space for everyone",
              })}
            </p>
            <div className="pride-gradient h-1 w-32 rounded-pill" aria-hidden />
          </div>
        </footer>
      </main>
    </div>
  );
}
