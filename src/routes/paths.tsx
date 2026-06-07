import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users, Heart, Scale, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import seed from "@/data/seed-data.json";

type PathSearch = { focus?: string };

export const Route = createFileRoute("/paths")({
  validateSearch: (raw: Record<string, unknown>): PathSearch => ({
    focus: typeof raw.focus === "string" ? raw.focus : undefined,
  }),
  component: PathsPage,
});

const iconMap = { users: Users, heart: Heart, scale: Scale, sparkles: Sparkles };

type Path = {
  id: string;
  accent: string;
  icon: keyof typeof iconMap;
  name: Localized;
  blurb: Localized;
  courseIds: string[];
};

type Course = {
  id: string;
  title: Localized;
  tagline: Localized;
  durationMins: number;
};

function PathsPage() {
  const { t, lang } = useLanguage();
  const { focus } = Route.useSearch();
  const { signedIn, enrolled, progress } = useAccount();

  const paths = seed.publicPortal.paths as Path[];
  const courses = seed.publicPortal.courses as Course[];
  const courseById = (id: string) => courses.find((c) => c.id === id);

  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (focus && refs.current[focus]) {
      refs.current[focus]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus]);

  return (
    <PublicLayout>
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="eyebrow mb-3">{t({ th: "เส้นทางเรียนรู้", en: "Learning paths" })}</p>
          <h1 lang={lang} className="max-w-2xl text-4xl font-semibold leading-tight text-navy-500">
            {t({
              th: "เรียนเป็นเส้นทาง ค่อยๆ สร้างความเข้าใจ",
              en: "Curated journeys to build understanding, step by step",
            })}
          </h1>
          <p lang={lang} className="mt-3 max-w-2xl text-lg text-warm-500">
            {t({
              th: "เลือกเส้นทางที่ใช่สำหรับคุณ แต่ละเส้นทางจัดเรียงคอร์สเป็นลำดับเพื่อให้เรียนรู้ได้อย่างต่อเนื่อง",
              en: "Pick a path that fits you. Each one orders courses so you can keep growing.",
            })}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-8 lg:grid-cols-2">
          {paths.map((p) => {
            const Icon = iconMap[p.icon] ?? Sparkles;
            const isFocus = focus === p.id;
            const pathCourses = p.courseIds.map(courseById).filter(Boolean) as Course[];
            const completed = signedIn
              ? pathCourses.filter((c) => (progress[c.id] ?? 0) >= 100).length
              : 0;
            const pctPath = pathCourses.length
              ? Math.round((completed / pathCourses.length) * 100)
              : 0;

            return (
              <article
                key={p.id}
                ref={(el) => {
                  refs.current[p.id] = el;
                }}
                className={`overflow-hidden rounded-lg border bg-white shadow-sm transition-all ${
                  isFocus
                    ? "border-magenta-500 shadow-md ring-2 ring-magenta-500/30"
                    : "border-warm-200"
                }`}
                style={{ scrollMarginTop: 96 }}
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: p.accent }} aria-hidden />
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${p.accent}1A`, color: p.accent }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h2 lang={lang} className="text-xl font-semibold text-navy-500">
                        {t(p.name)}
                      </h2>
                      <p lang={lang} className="mt-1 text-sm text-warm-500">
                        {t(p.blurb)}
                      </p>
                    </div>
                  </div>

                  {signedIn && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs font-medium text-navy-500">
                        <span lang={lang}>
                          {t({ th: "ความคืบหน้าเส้นทาง", en: "Path progress" })}
                        </span>
                        <span>
                          {completed}/{pathCourses.length} · {pctPath}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-warm-100">
                        <div
                          className="h-full rounded-pill"
                          style={{ width: `${pctPath}%`, backgroundColor: p.accent }}
                        />
                      </div>
                    </div>
                  )}

                  <ol className="mt-6 space-y-3">
                    {pathCourses.map((c, i) => {
                      const pct = progress[c.id] ?? 0;
                      const done = signedIn && pct >= 100;
                      return (
                        <li key={c.id}>
                          <Link
                            to="/courses/$id"
                            params={{ id: c.id }}
                            className="group flex items-start gap-3 rounded-md border border-warm-200 bg-cream p-3 transition-all hover:border-magenta-500 hover:bg-white"
                          >
                            <div
                              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-xs font-semibold"
                              style={{
                                backgroundColor: done ? p.accent : "#fff",
                                color: done ? "#fff" : p.accent,
                                border: `1.5px solid ${p.accent}`,
                              }}
                            >
                              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p
                                  lang={lang}
                                  className="truncate text-sm font-semibold text-navy-500"
                                >
                                  {t(c.title)}
                                </p>
                                <ArrowRight className="h-4 w-4 shrink-0 text-warm-500 transition-transform group-hover:translate-x-0.5 group-hover:text-magenta-500" />
                              </div>
                              <p lang={lang} className="mt-0.5 truncate text-xs text-warm-500">
                                {t(c.tagline)} · {c.durationMins}m
                              </p>
                              {signedIn && enrolled.includes(c.id) && pct > 0 && pct < 100 && (
                                <div className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-warm-100">
                                  <div
                                    className="h-full rounded-pill"
                                    style={{ width: `${pct}%`, backgroundColor: p.accent }}
                                  />
                                </div>
                              )}
                              {!signedIn && (
                                <div className="mt-1 inline-flex items-center gap-1 text-xs text-warm-500">
                                  <Circle className="h-3 w-3" />
                                  <span lang={lang}>
                                    {t({ th: "ยังไม่เริ่ม", en: "Not started" })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}
