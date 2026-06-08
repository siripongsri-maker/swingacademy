import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Search, X, GraduationCap, BookOpen, Globe } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { CourseCard, type Course } from "@/components/course-card";
import { useLanguage, type Localized } from "@/lib/language-context";
import { listPublicKnowledge } from "@/lib/knowledge.functions";
import seed from "@/data/seed-data.json";
import { pageHead } from "@/lib/seo";

type CourseSearch = { category?: string; tab?: string };

const knowledgeQueryOptions = () =>
  queryOptions({
    queryKey: ["knowledge", "public", "all"],
    queryFn: () => listPublicKnowledge(),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/courses")({
  validateSearch: (raw: Record<string, unknown>): CourseSearch => ({
    category: typeof raw.category === "string" ? raw.category : undefined,
    tab: typeof raw.tab === "string" ? raw.tab : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(knowledgeQueryOptions()),
  head: () =>
    pageHead({
      title: "Courses — SWING Academy",
      description:
        "Browse all SWING Academy courses on sexual health, rights, life skills, and wellbeing. Filter by category and level — free and bilingual (TH/EN).",
      path: "/courses",
    }),
  component: CoursesPage,
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">{error.message}</div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">ไม่พบเนื้อหา</div>
    </PublicLayout>
  ),
});

const LEVELS = ["beginner", "intermediate", "advanced"] as const;

function CoursesPage() {
  const { t, lang } = useLanguage();
  const { category: initialCategory, tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/courses" });
  const isKnowledge = tab === "knowledge";

  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<string | null>(null);

  const categories = seed.publicPortal.categories as {
    id: string;
    name: Localized;
    color: string;
  }[];
  const courses = seed.publicPortal.courses as (Course & {
    summary: Localized;
  })[];
  const levelLabel = seed.publicPortal.levelLabel as Record<string, Localized>;

  const activeCategory = initialCategory ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (activeCategory && c.category !== activeCategory) return false;
      if (level && c.level !== level) return false;
      if (!q) return true;
      const blob = [c.title.th, c.title.en, c.tagline.th, c.tagline.en, c.summary.th, c.summary.en]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [courses, query, level, activeCategory]);

  const setCategory = (id: string | null) => {
    navigate({ search: id ? { category: id } : {} });
  };

  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-0">
        <p className="eyebrow mb-3">
          {isKnowledge
            ? t({ th: "ความรู้สาธารณะ", en: "Public Knowledge" })
            : t({ th: "คอร์สทั้งหมด", en: "All courses" })}
        </p>
        <h1 lang={lang} className="text-4xl font-semibold text-navy-500 md:text-5xl">
          {isKnowledge
            ? t({ th: "ค้นหา Knowledge ที่น่าสนใจ", en: "Find knowledge that interests you" })
            : t({ th: "ค้นหาคอร์สที่ใช่สำหรับคุณ", en: "Find a course that fits you" })}
        </h1>
        <p lang={lang} className="mt-3 max-w-2xl text-warm-500">
          {isKnowledge
            ? t({
                th: "เนื้อหาสาธารณะที่ SWING และพันธมิตรเผยแพร่ — เปิดให้ใช้เพื่อการศึกษาและพัฒนาบริการของชุมชน",
                en: "Public content from SWING and partners — free to use for education and community service development.",
              })
            : t({
                th: "ฟรีทุกคอร์ส เป็นความลับ และเรียนได้ทุกที่ทุกเวลา",
                en: "Every course is free, private, and available anywhere, anytime.",
              })}
        </p>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-warm-200 mt-8">
          <TabButton
            active={!isKnowledge}
            onClick={() => navigate({ search: (prev: CourseSearch) => ({ ...prev, tab: undefined }) })}
          >
            {t({ th: "คอร์ส", en: "Courses" })}
          </TabButton>
          <TabButton
            active={isKnowledge}
            onClick={() => navigate({ search: (prev: CourseSearch) => ({ ...prev, tab: "knowledge" }) })}
          >
            {t({ th: "Knowledge", en: "Knowledge" })}
          </TabButton>
        </div>
      </section>

      {isKnowledge ? (
        <KnowledgeSection />
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-6 pt-8 pb-0">
            {/* Search */}
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t({ th: "ค้นหาคอร์ส...", en: "Search courses..." })}
                className="h-12 w-full rounded-pill border border-warm-200 bg-white pl-11 pr-10 text-sm text-navy-500 outline-none transition-colors placeholder:text-warm-400 focus:border-magenta-500"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-pill p-1 text-warm-500 hover:bg-warm-100"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span lang={lang} className="text-xs font-semibold uppercase tracking-wider text-warm-500">
                  {t({ th: "หมวด", en: "Category" })}
                </span>
                <Chip active={!activeCategory} onClick={() => setCategory(null)}>
                  {t({ th: "ทั้งหมด", en: "All" })}
                </Chip>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    active={activeCategory === c.id}
                    accent={c.color}
                    onClick={() => setCategory(activeCategory === c.id ? null : c.id)}
                  >
                    {t(c.name)}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span lang={lang} className="text-xs font-semibold uppercase tracking-wider text-warm-500">
                  {t({ th: "ระดับ", en: "Level" })}
                </span>
                <Chip active={!level} onClick={() => setLevel(null)}>
                  {t({ th: "ทั้งหมด", en: "All" })}
                </Chip>
                {LEVELS.map((lv) => (
                  <Chip
                    key={lv}
                    active={level === lv}
                    onClick={() => setLevel(level === lv ? null : lv)}
                  >
                    {t(levelLabel[lv])}
                  </Chip>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-6 pt-8 pb-24">
            <p className="mb-5 text-sm text-warm-500">
              {filtered.length} {t({ th: "คอร์ส", en: "courses" })}
            </p>
            {courses.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="h-10 w-10" />}
                title={t({ th: "ยังไม่มีคอร์สในระบบ", en: "No courses available yet" })}
                body={t({
                  th: "คอร์สและเนื้อหาใหม่จะถูกเพิ่มเร็ว ๆ นี้ กรุณากลับมาตรวจสอบอีกครั้ง",
                  en: "New courses will be added soon. Please check back later.",
                })}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title={t({ th: "ไม่พบคอร์สที่ตรงกับการค้นหา", en: "No courses match your search" })}
                body={t({
                  th: "ลองปรับตัวกรองหรือคำค้นหาใหม่",
                  en: "Try adjusting your filters or search terms",
                })}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                  <Link
                    key={c.id}
                    to="/courses/$id"
                    params={{ id: c.id }}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-magenta-500 rounded-md"
                  >
                    <CourseCard course={c} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </PublicLayout>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-3 text-sm font-semibold transition-colors ${
        active ? "text-navy-500 border-b-2 border-navy-500" : "text-warm-400 hover:text-warm-600"
      }`}
    >
      {children}
    </button>
  );
}

function KnowledgeSection() {
  const { t } = useLanguage();
  const { data } = useSuspenseQuery(knowledgeQueryOptions());
  const items = data.items;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((k) => {
      const blob = [k.titleTh, k.titleEn, k.summary, k.keyMessage, k.tags.join(" "), k.categories.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, query]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-8 pb-0">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t({ th: "ค้นหา Knowledge...", en: "Search knowledge..." })}
            className="h-12 w-full rounded-pill border border-warm-200 bg-white pl-11 pr-10 text-sm text-navy-500 outline-none transition-colors placeholder:text-warm-400 focus:border-magenta-500"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-pill p-1 text-warm-500 hover:bg-warm-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-8 pb-24">
        <p className="mb-5 text-sm text-warm-500">
          {filtered.length} {t({ th: "รายการ", en: "items" })}
        </p>
        {items.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-10 w-10" />}
            title={t({ th: "ยังไม่มี Knowledge ในระบบ", en: "No knowledge available yet" })}
            body={t({
              th: "เนื้อหาใหม่จะถูกเพิ่มเร็ว ๆ นี้ กรุณากลับมาตรวจสอบอีกครั้ง",
              en: "New knowledge content will be added soon. Please check back later.",
            })}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title={t({ th: "ไม่พบรายการที่ตรงกับการค้นหา", en: "No items match your search" })}
            body={t({
              th: "ลองปรับคำค้นหาใหม่",
              en: "Try adjusting your search terms",
            })}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((k) => (
              <Link
                key={k.id}
                to="/knowledge/$slug"
                params={{ slug: k.slug }}
                className="group flex flex-col rounded-lg border border-warm-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-lavender-100 text-lavender-900">
                  <BookOpen className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-navy-500 group-hover:text-magenta-500">
                  {k.titleTh}
                </h2>
                {k.titleEn && <p className="mt-0.5 text-xs italic text-warm-500">{k.titleEn}</p>}
                {k.summary && (
                  <p className="mt-3 line-clamp-3 flex-1 text-sm text-warm-600">{k.summary}</p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-warm-500">
                  <Globe className="h-3 w-3" /> Public Knowledge
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-warm-300 bg-white p-12 text-center">
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-lavender-100 text-lavender-900">
        {icon}
      </div>
      <p className="text-base font-semibold text-navy-500">{title}</p>
      <p className="mt-1 text-sm text-warm-500">{body}</p>
    </div>
  );
}

function Chip({
  active,
  accent,
  children,
  onClick,
}: {
  active: boolean;
  accent?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-pill border px-3.5 py-1.5 text-xs font-semibold transition-all"
      style={
        active
          ? {
              backgroundColor: accent ?? "#2E295C",
              borderColor: accent ?? "#2E295C",
              color: "white",
            }
          : {
              backgroundColor: "white",
              borderColor: "#E8E4E0",
              color: "#2E295C",
            }
      }
    >
      {children}
    </button>
  );
}
