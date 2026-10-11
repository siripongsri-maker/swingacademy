import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import {
  Heart,
  Scale,
  Sparkles,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  Lock,
  WifiOff,
  Smartphone,
  Award,
  BookOpen,
  Languages,
  Library,
  MessageCircle,
  Route as RouteIcon,
  Search,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import seed from "@/data/seed-data.json";
import { pageHead } from "@/lib/seo";
import { listPublicKnowledge } from "@/lib/knowledge.functions";
import { HomepageVisitCounter } from "@/components/homepage-visit-counter";
import { PhraseText } from "@/components/phrase-text";
import { RouteError, RouteNotFound } from "@/components/route-fallback";

// Shared with /knowledge and /courses, so errors must not be cached as an empty success.
const knowledgeQueryOptions = queryOptions({
  queryKey: ["knowledge", "public", "all"],
  queryFn: () => listPublicKnowledge(),
  staleTime: 60_000,
});

// SWING's LINE account, already used on /verify.
const LINE_URL = "https://line.me/R/ti/p/@swingthailand";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "SWING Academy · Free community learning on sexual health & rights",
      description:
        "Free Thai and English lessons from frontline community workers on sexual health, rights and work skills, from the SWING Foundation.",
      path: "/",
    }),
  // The library list is a bonus on the homepage: if it fails, render the page without it.
  // Only the card fields are returned, so the article bodies stay out of the homepage HTML.
  loader: async ({ context }) => {
    try {
      const { items } = await context.queryClient.ensureQueryData(knowledgeQueryOptions);
      return {
        total: items.length,
        items: items.slice(0, 6).map(({ id, slug, coverUrl, titleTh, titleEn, summary }) => ({
          id,
          slug,
          coverUrl,
          titleTh,
          titleEn,
          summary,
        })),
      };
    } catch {
      return { total: 0, items: [] };
    }
  },
  component: HomePage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

type Partner = { id: string; short: string; color: string; role: Localized };

const REASSURE: { icon: typeof HeartHandshake; label: Localized }[] = [
  { icon: HeartHandshake, label: { th: "ฟรีเสมอ", en: "Always free" } },
  { icon: ShieldCheck, label: { th: "ไม่ต้องใช้บัตรประชาชน", en: "No ID required" } },
  { icon: Lock, label: { th: "เป็นความลับ", en: "Private & confidential" } },
  { icon: Heart, label: { th: "เคารพทุกคน", en: "Respect for everyone" } },
];

// Example searches that match published titles today.
const EXAMPLE_QUERIES: { label: Localized; q: Localized }[] = [
  { label: { th: "PrEP", en: "PrEP" }, q: { th: "PrEP", en: "PrEP" } },
  {
    label: { th: "ตรวจเอชไอวีด้วยตนเอง", en: "HIV self-testing" },
    q: { th: "ตรวจเอชไอวีด้วยตนเอง", en: "HIV self-testing" },
  },
  {
    label: { th: "เริ่มยาต้านในวันเดียว (SDART)", en: "Same-day ART (SDART)" },
    q: { th: "SDART", en: "SDART" },
  },
];

const CATEGORIES = [
  {
    id: "research",
    icon: BookOpen,
    tone: "bg-accuracy-soft text-accuracy-ink",
    name: { th: "งานวิจัยจากชุมชน", en: "Community research" },
    blurb: {
      th: "งานวิจัย รายงาน และข้อมูลจากภาคสนามโดย SWING และเครือข่าย",
      en: "Studies, reports & field data from SWING and partners",
    },
    to: "/knowledge" as const,
    cta: { th: "อ่านงานวิจัย", en: "Read research" },
  },
  {
    id: "lessons",
    icon: Sparkles,
    tone: "bg-dignity-soft text-dignity-ink",
    name: { th: "บทเรียนภาคสนาม", en: "Field lessons" },
    blurb: {
      th: "ถอดบทเรียนจากงานจริงขององค์กรชุมชน (CBO) และผู้ให้ความรู้ในกลุ่มเพื่อน",
      en: "Lessons from the real work of community-based organisations (CBOs) and peer educators",
    },
    to: "/knowledge" as const,
    cta: { th: "ดูบทเรียน", en: "View lessons" },
  },
  {
    id: "rights",
    icon: Scale,
    tone: "bg-lavender-100 text-lavender-900",
    name: { th: "สิทธิและการรณรงค์", en: "Rights & advocacy" },
    blurb: {
      th: "สิทธิแรงงาน สิทธิทางเพศ และเครื่องมือที่ชุมชนใช้ผลักดันเรื่องสิทธิ",
      en: "Labour rights, sexual rights and tools communities use to push for change",
    },
    to: "/knowledge" as const,
    cta: { th: "รู้สิทธิของคุณ", en: "Know your rights" },
  },
  {
    id: "cbo-skills",
    icon: HeartHandshake,
    tone: "bg-navy-100 text-navy-500",
    name: { th: "ทักษะงานองค์กรชุมชน", en: "Community organisation skills" },
    blurb: {
      th: "คอร์สและบทเรียนสำหรับนักกิจกรรมและทีมงานชุมชน",
      en: "Courses & lessons for community organisers and staff",
    },
    to: "/courses" as const,
    cta: { th: "ไปที่คอร์ส", en: "Go to courses" },
  },
];

const ACCESS: { icon: typeof Smartphone; label: Localized }[] = [
  { icon: Smartphone, label: { th: "อ่านบนมือถือได้สบาย", en: "Easy to read on your phone" } },
  {
    icon: WifiOff,
    label: {
      th: "บางเรื่องมี PDF ให้โหลดไปอ่านออฟไลน์",
      en: "Some items have PDFs to read offline",
    },
  },
  { icon: Languages, label: { th: "อ่านได้ทั้งไทยและอังกฤษ", en: "In Thai and English" } },
];

const MORE_LINKS: {
  icon: typeof Library;
  to: "/knowledge" | "/paths" | "/verify";
  label: Localized;
}[] = [
  { icon: Library, to: "/knowledge", label: { th: "เปิดคลังความรู้", en: "Open the library" } },
  { icon: RouteIcon, to: "/paths", label: { th: "ดูเส้นทางเรียนรู้", en: "See learning paths" } },
  { icon: Award, to: "/verify", label: { th: "ตรวจสอบใบประกาศ", en: "Verify a certificate" } },
];

const eyebrow = "mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-accuracy-ink";
const cardLift =
  "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:shadow-md";

function SectionHeading({
  kicker,
  title,
  intro,
  center = false,
}: {
  kicker: string;
  title: string;
  intro?: string;
  center?: boolean;
}) {
  const { lang } = useLanguage();
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className={eyebrow}>{kicker}</p>
      <h2 lang={lang} className="text-balance text-3xl font-semibold text-navy-500 md:text-4xl">
        <PhraseText text={title} />
      </h2>
      {intro && (
        <p lang={lang} className="mt-4 text-base text-warm-600 md:text-lg">
          {intro}
        </p>
      )}
    </div>
  );
}

function HeroSearch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    navigate({ to: "/knowledge", search: query ? { q: query } : {} });
  };

  return (
    <div className="mt-8">
      <form
        role="search"
        action="/knowledge"
        method="get"
        onSubmit={submit}
        className="flex items-center gap-2 rounded-pill border border-warm-300 bg-white p-1.5 pl-5 shadow-md transition-shadow focus-within:border-accuracy focus-within:shadow-lg"
      >
        <Search className="h-5 w-5 shrink-0 text-warm-400" aria-hidden />
        <label htmlFor="hero-search" className="sr-only">
          {t({ th: "ค้นหาในคลังความรู้", en: "Search the knowledge library" })}
        </label>
        <input
          id="hero-search"
          name="q"
          type="search"
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t({ th: "ค้นบทเรียน เช่น PrEP", en: "Search, e.g. PrEP" })}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-navy-500 placeholder:text-warm-500 focus:outline-hidden"
        />
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill bg-navy-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
        >
          {t({ th: "ค้นหา", en: "Search" })}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-1 text-sm">
        <span className="text-warm-600">{t({ th: "เช่น", en: "e.g." })}</span>
        {EXAMPLE_QUERIES.map((ex) => (
          <Link
            key={ex.label.en}
            to="/knowledge"
            search={{ q: t(ex.q) }}
            className="inline-flex min-h-11 items-center rounded-pill border border-accuracy/25 bg-accuracy-soft/60 px-4 text-sm font-medium text-accuracy-ink transition-colors hover:bg-accuracy-soft"
          >
            {t(ex.label)}
          </Link>
        ))}
      </div>
    </div>
  );
}

type CardItem = {
  id: string;
  slug: string;
  coverUrl: string | null;
  titleTh: string;
  titleEn: string | null;
  summary: string | null;
};

/** Hero card: the newest items in the library, from real data. */
function NewInLibraryCard({ total, items }: { total: number; items: CardItem[] }) {
  const { t, lang } = useLanguage();
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-accuracy-soft via-white to-dignity-soft opacity-80 blur-xl"
      />
      <div className="relative overflow-hidden rounded-lg border border-warm-200 bg-white shadow-lg">
        <div className="flex items-center gap-3 px-6 pt-6">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-accuracy-soft text-accuracy-ink">
            <Library className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accuracy-ink">
              {t({ th: "เพิ่งขึ้นคลัง", en: "New in the library" })}
            </p>
            <p lang={lang} className="text-base font-semibold text-navy-500">
              {total > 0
                ? t({
                    th: `มีทั้งหมด ${total} เรื่อง อ่านฟรีทุกเรื่อง`,
                    en: `${total} items, all free to read`,
                  })
                : t({
                    th: "งานวิจัยและบทเรียนจากชุมชน",
                    en: "Research and lessons from the community",
                  })}
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-2 px-6">
          {items.length > 0
            ? items.map((k) => (
                <li key={k.id}>
                  <Link
                    to="/knowledge/$slug"
                    params={{ slug: k.slug }}
                    className="group flex min-h-14 items-center gap-3 rounded-md border border-warm-200 bg-cream px-3.5 py-3 transition-colors hover:border-accuracy/40 hover:bg-white"
                  >
                    <BookOpen className="h-4 w-4 shrink-0 text-accuracy" aria-hidden />
                    <span
                      lang={lang === "en" && k.titleEn ? "en" : "th"}
                      className="line-clamp-2 min-w-0 flex-1 text-sm font-medium text-navy-500 group-hover:text-accuracy-ink"
                    >
                      {t({ th: k.titleTh, en: k.titleEn || k.titleTh })}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-warm-400 transition-transform group-hover:translate-x-0.5 group-hover:text-accuracy"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))
            : [
                { th: "งานวิจัยจากชุมชน", en: "Community-led research" },
                { th: "บทเรียนจากประสบการณ์จริง", en: "Lessons from real experience" },
                { th: "ความรู้เพื่อการทำงาน", en: "Knowledge for the work" },
              ].map((l) => (
                <li
                  key={l.en}
                  className="flex min-h-14 items-center gap-3 rounded-md border border-warm-200 bg-cream px-3.5 py-3"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-accuracy" aria-hidden />
                  <span lang={lang} className="text-sm font-medium text-navy-500">
                    {t(l)}
                  </span>
                </li>
              ))}
        </ul>

        <Link
          to="/knowledge"
          className="mt-5 flex items-center justify-between gap-2 bg-navy-500 px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-navy-700 focus-visible:outline-white"
        >
          {t({ th: "เปิดคลังความรู้", en: "Open the library" })}
          <ArrowRight className="h-4 w-4 text-dignity" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function HomePage() {
  const { t, lang } = useLanguage();
  const partners = seed.publicPortal.partners as Partner[];
  const { total: knowledgeTotal, items: knowledgeItems } = Route.useLoaderData();

  return (
    <PublicLayout flushFooter>
      {/* 1. HERO: search the library, and see what is new in it */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-accuracy-soft opacity-70 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -right-24 -bottom-48 h-[28rem] w-[28rem] rounded-full bg-dignity-soft opacity-80 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pt-14 pb-20 md:pt-20 md:pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className={eyebrow}>
              {t({
                th: "SWING Academy · เรียนฟรี สองภาษา",
                en: "SWING Academy · Free, in Thai & English",
              })}
            </p>
            <h1
              lang={lang}
              className="text-balance text-4xl leading-[1.38] font-semibold text-navy-500 md:text-5xl md:leading-[1.38] lg:text-[3.4rem] lg:leading-[1.38]"
            >
              <PhraseText
                text={t({
                  th: "ความรู้จาก|เสียงคนหน้างาน",
                  en: "Know-how from the frontline,",
                })}
              />{" "}
              <span className="bg-[linear-gradient(transparent_60%,var(--color-dignity-soft)_60%)] text-accuracy-ink">
                <PhraseText
                  text={t({
                    th: "ที่ค้นง่าย |และใช้ได้จริง",
                    en: "easy to find and use",
                  })}
                />
              </span>
            </h1>
            <p lang={lang} className="mt-5 max-w-xl text-lg text-warm-600">
              {t({
                th: "พื้นที่เรียนรู้ฟรีสำหรับชุมชน รวมบทเรียนจากคนทำงานจริง ทั้งสุขภาพทางเพศ สิทธิ และทักษะการทำงาน ค้นได้ เรียนได้ ตามจังหวะของคุณ",
                en: "A free learning space for our communities, with lessons from people doing the work: sexual health, rights and work skills. Search it and learn at your own pace.",
              })}
            </p>

            <HeroSearch />

            <ul className="mt-7 flex flex-wrap gap-2">
              {REASSURE.map(({ icon: Icon, label }) => (
                <li
                  key={label.en}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-warm-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-navy-500"
                >
                  <Icon className="h-3.5 w-3.5 text-accuracy" aria-hidden />
                  <span lang={lang}>{t(label)}</span>
                </li>
              ))}
            </ul>

            <HomepageVisitCounter />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <NewInLibraryCard total={knowledgeTotal} items={knowledgeItems.slice(0, 3)} />
          </div>
        </div>
      </section>

      {/* 2. LATEST KNOWLEDGE (from backend) */}
      {knowledgeItems.length > 0 && (
        <section className="border-y border-warm-200 bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                kicker={t({ th: "เพิ่งขึ้นคลัง", en: "New in the library" })}
                title={t({
                  th: "งานวิจัย บทเรียน |และความรู้จากชุมชน",
                  en: "Research, lessons & community knowledge",
                })}
              />
              <Link
                to="/knowledge"
                className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-accuracy-ink hover:text-accuracy"
              >
                {t({ th: `ดูทั้งหมด ${knowledgeTotal} เรื่อง`, en: `See all ${knowledgeTotal}` })}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {knowledgeItems.map((k) => (
                <Link
                  key={k.id}
                  to="/knowledge/$slug"
                  params={{ slug: k.slug }}
                  aria-labelledby={`k-${k.id}-title`}
                  className={`group flex flex-col overflow-hidden rounded-lg border border-warm-200 bg-cream/40 ${cardLift}`}
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-accuracy-soft via-cream to-dignity-soft">
                    {k.coverUrl ? (
                      <img
                        src={k.coverUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-accuracy/70">
                        <BookOpen className="h-10 w-10" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3
                      id={`k-${k.id}-title`}
                      lang={lang === "en" && k.titleEn ? "en" : "th"}
                      className="line-clamp-3 text-lg font-semibold text-navy-500 group-hover:text-accuracy-ink"
                    >
                      {t({ th: k.titleTh, en: k.titleEn || k.titleTh })}
                    </h3>
                    {k.titleEn && k.titleEn !== k.titleTh && (
                      <p
                        lang={lang === "en" ? "th" : "en"}
                        className="mt-1 line-clamp-2 text-xs text-warm-500"
                      >
                        {t({ th: k.titleEn, en: k.titleTh })}
                      </p>
                    )}
                    {k.summary && (
                      <p lang="th" className="mt-3 line-clamp-3 flex-1 text-sm text-warm-600">
                        {k.summary}
                      </p>
                    )}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accuracy-ink">
                      {t({ th: "อ่านต่อ", en: "Read more" })}
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. CATEGORIES */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10">
          <SectionHeading
            kicker={t({ th: "เริ่มจากหมวดที่ใช่", en: "Start where it fits" })}
            title={t({
              th: "เลือกเรื่อง |ที่ตรงกับงานของคุณ",
              en: "Pick what fits your work",
            })}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                to={cat.to}
                className={`group flex flex-col rounded-lg border border-warm-200 bg-white p-6 shadow-sm ${cardLift}`}
              >
                <span
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md ${cat.tone}`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 lang={lang} className="text-lg font-semibold text-navy-500">
                  {t(cat.name)}
                </h3>
                <p lang={lang} className="mt-2 flex-1 text-sm text-warm-600">
                  {t(cat.blurb)}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accuracy-ink">
                  {t(cat.cta)}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </div>

        <ul className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 rounded-lg border border-warm-200 bg-white/70 px-6 py-5">
          {ACCESS.map(({ icon: Icon, label }) => (
            <li
              key={label.en}
              className="inline-flex items-center gap-2 text-sm font-medium text-navy-500"
            >
              <Icon className="h-4 w-4 text-accuracy" aria-hidden />
              <span lang={lang}>{t(label)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. PARTNERS */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8">
          <SectionHeading
            kicker={t({ th: "ภาคี", en: "Partners" })}
            title={t({ th: "ภาคีที่ทำงานกับเรา", en: "Partners we work with" })}
          />
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {partners.map((p) => (
            <li
              key={p.id}
              className="relative overflow-hidden rounded-md border border-warm-200 bg-white p-5 shadow-sm"
            >
              <span
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <p className="text-sm font-semibold text-navy-500">{p.short}</p>
              <p lang={lang} className="mt-1 text-xs text-warm-600">
                {t(p.role)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. HELP CALLOUT + FINAL CTA */}
      <section className="relative overflow-hidden bg-navy-500 text-white">
        <div
          aria-hidden
          className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-accuracy opacity-25 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -right-24 -bottom-32 h-80 w-80 rounded-full bg-dignity opacity-20 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-dignity">
              {t({ th: "อยากถามอะไรไหม", en: "Got a question?" })}
            </p>
            <h2 lang={lang} className="text-balance text-3xl font-semibold md:text-4xl">
              <PhraseText
                text={t({
                  th: "ถามได้ |มีคนฟังจริง",
                  en: "Ask us. Real people answer.",
                })}
              />
            </h2>
            <p lang={lang} className="mt-4 max-w-xl text-base text-lavender-300">
              {t({
                th: "ทีม SWING พร้อมฟัง ตอบคำถาม และแนะนำบริการฟรีที่เป็นมิตร โดยคุณเป็นคนเลือกเองว่าจะไปที่ไหน",
                en: "The SWING team listens, answers questions and points you to free, friendly services. You choose where to go.",
              })}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={LINE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-pill bg-dignity px-6 text-sm font-semibold text-navy-900 shadow-md transition-colors hover:bg-[#D9B743] focus-visible:outline-white"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t({ th: "ทักทีม SWING ทาง LINE", en: "Message SWING on LINE" })}
              </a>
              <Link
                to="/courses"
                className="inline-flex h-12 items-center gap-2 rounded-pill border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-white"
              >
                {t({ th: "เริ่มเรียนเลย", en: "Start learning" })}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <ul className="grid gap-3">
            {MORE_LINKS.map(({ icon: Icon, to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="group flex min-h-14 items-center gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus-visible:outline-white"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-white/10 text-dignity">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span lang={lang} className="flex-1 text-sm font-medium">
                    {t(label)}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-lavender-300 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
