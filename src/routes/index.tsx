import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
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
  MapPin,
  BookOpen,
  HelpCircle,
  Library,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import seed from "@/data/seed-data.json";
import { pageHead } from "@/lib/seo";
import { listPublicKnowledge } from "@/lib/knowledge.functions";
import { HomepageVisitCounter } from "@/components/homepage-visit-counter";
import { PhraseText } from "@/components/phrase-text";

const knowledgeQueryOptions = queryOptions({
  queryKey: ["knowledge", "public", "all"],
  // The knowledge list is a bonus on the homepage: if it fails, still render the page.
  queryFn: () =>
    listPublicKnowledge().catch(() => ({
      items: [] as Awaited<ReturnType<typeof listPublicKnowledge>>["items"],
    })),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "SWING Academy · Free bilingual learning on sexual health & rights",
      description:
        "Free, bilingual (TH/EN) courses on sexual health, rights, and life skills from the SWING Foundation. Warm, stigma-free learning for our communities.",
      path: "/",
    }),
  loader: ({ context }) => context.queryClient.ensureQueryData(knowledgeQueryOptions),
  component: HomePage,
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">
        โหลดหน้าไม่สำเร็จ: {error.message}
      </div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">ไม่พบเนื้อหา</div>
    </PublicLayout>
  ),
});

type Partner = { id: string; short: string; color: string; role: Localized };

const REASSURE: { icon: typeof HeartHandshake; label: Localized }[] = [
  { icon: HeartHandshake, label: { th: "ฟรีเสมอ", en: "Always free" } },
  { icon: ShieldCheck, label: { th: "ไม่ต้องใช้บัตรประชาชน", en: "No ID required" } },
  { icon: Lock, label: { th: "เป็นความลับ", en: "Private & confidential" } },
  { icon: Heart, label: { th: "ไม่มีการตัดสิน", en: "No judgment" } },
];

const CATEGORIES = [
  {
    id: "research",
    icon: BookOpen,
    tone: "bg-magenta-100 text-magenta-700",
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
    tone: "bg-lavender-100 text-lavender-900",
    name: { th: "บทเรียนภาคสนาม", en: "Field lessons" },
    blurb: {
      th: "ถอดบทเรียนจากการทำงานจริงของ CBO และพี่เลี้ยงชุมชน",
      en: "Lessons learned from CBO and peer-educator practice",
    },
    to: "/knowledge" as const,
    cta: { th: "ดูบทเรียน", en: "View lessons" },
  },
  {
    id: "rights",
    icon: Scale,
    tone: "bg-gold/15 text-[#8A6D12]",
    name: { th: "สิทธิและการสนับสนุน", en: "Rights & advocacy" },
    blurb: {
      th: "สิทธิแรงงาน สิทธิทางเพศ และเครื่องมือสนับสนุนชุมชน",
      en: "Labour rights, sexual rights & community advocacy tools",
    },
    to: "/knowledge" as const,
    cta: { th: "เรียนรู้สิทธิ", en: "Learn rights" },
  },
  {
    id: "cbo-skills",
    icon: HeartHandshake,
    tone: "bg-success/10 text-success",
    name: { th: "ทักษะการทำงาน CBO", en: "CBO work skills" },
    blurb: {
      th: "คอร์สและบทเรียนสำหรับนักกิจกรรมและทีมงานชุมชน",
      en: "Courses & lessons for community organisers and staff",
    },
    to: "/courses" as const,
    cta: { th: "ไปที่คอร์ส", en: "Go to courses" },
  },
];

const ACCESS: { icon: typeof Smartphone; label: Localized }[] = [
  { icon: Smartphone, label: { th: "เปิดในมือถือได้ดี", en: "Mobile-friendly" } },
  { icon: WifiOff, label: { th: "ดาวน์โหลดอ่านออฟไลน์ได้", en: "Works offline" } },
  { icon: Lock, label: { th: "เป็นความลับเสมอ", en: "Always private" } },
];

const HELP: { icon: typeof HelpCircle; label: Localized }[] = [
  { icon: HelpCircle, label: { th: "คุยกับพี่เลี้ยงชุมชน", en: "Talk to a peer educator" } },
  { icon: MapPin, label: { th: "ค้นหาบริการใกล้บ้าน", en: "Find services near you" } },
  { icon: BookOpen, label: { th: "เรียนรู้ด้วยตัวเอง", en: "Self-paced learning" } },
  { icon: Award, label: { th: "รับใบประกาศ", en: "Earn certificates" } },
];

const btnPrimary =
  "inline-flex h-12 items-center gap-2 rounded-pill bg-magenta-500 px-6 text-sm font-semibold text-white shadow-md transition-colors hover:bg-magenta-700";
const btnSecondary =
  "inline-flex h-12 items-center gap-2 rounded-pill border border-navy-300 bg-white px-6 text-sm font-semibold text-navy-500 transition-colors hover:border-navy-500 hover:bg-navy-100/40";
const cardLift =
  "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:shadow-md";

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  const { lang } = useLanguage();
  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 lang={lang} className="text-balance text-3xl font-semibold text-navy-500 md:text-4xl">
        <PhraseText text={title} />
      </h2>
      {intro && (
        <p lang={lang} className="mt-3 text-base text-warm-600">
          {intro}
        </p>
      )}
    </div>
  );
}

function HomePage() {
  const { t, lang } = useLanguage();
  const partners = seed.publicPortal.partners as Partner[];
  const { data: knowledgeData } = useSuspenseQuery(knowledgeQueryOptions);
  const knowledgeTotal = knowledgeData.items.length;
  const knowledgeItems = knowledgeData.items.slice(0, 6);
  const newest = knowledgeData.items.slice(0, 3);

  return (
    <PublicLayout flushFooter>
      {/* 1. HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-magenta-100 opacity-60 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-lavender-100 opacity-70 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-14 pb-20 md:pt-20 md:pb-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="eyebrow mb-5">
              {t({
                th: "SWING Academy · เรียนฟรี สองภาษา",
                en: "SWING Academy · Free, in Thai & English",
              })}
            </p>
            <h1
              lang={lang}
              className="text-balance text-4xl font-semibold text-navy-500 md:text-5xl lg:text-[3.5rem]"
            >
              <PhraseText
                text={t({
                  th: "เรียนรู้ |ดูแลตัวเอง |และเคารพ|ในสิทธิ์ของเรา",
                  en: "Learn, care for yourself, and know your rights.",
                })}
              />
            </h1>
            <p lang={lang} className="mt-5 max-w-xl text-lg text-warm-600">
              {t({
                th: "พื้นที่เรียนรู้ฟรีสำหรับชุมชนของเรา ทั้งสุขภาพทางเพศ สิทธิ ทักษะชีวิต และการดูแลใจ เรียนตอนไหนก็ได้ ตามจังหวะของคุณ",
                en: "A free learning space for our communities: sexual health, rights, life skills and wellbeing. Learn whenever you like, at your own pace.",
              })}
            </p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {REASSURE.map(({ icon: Icon, label }) => (
                <li
                  key={label.en}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-500"
                >
                  <Icon className="h-3.5 w-3.5 text-magenta-500" aria-hidden />
                  <span lang={lang}>{t(label)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/courses" className={btnPrimary}>
                {t({ th: "เริ่มเรียนเลย", en: "Start learning" })}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/knowledge" className={btnSecondary}>
                <Library className="h-4 w-4" aria-hidden />
                {t({ th: "เปิดคลังความรู้", en: "Open the library" })}
              </Link>
            </div>

            <HomepageVisitCounter />
          </div>

          {/* What's in the library right now */}
          <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div
              className="pride-gradient absolute -inset-2 rounded-lg opacity-15 blur-2xl"
              aria-hidden
            />
            <div className="relative rounded-lg border border-warm-200 bg-white p-6 shadow-lg md:p-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-magenta-100 text-magenta-500">
                  <BookOpen className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="eyebrow">
                    {t({ th: "คลังความรู้จากชุมชน", en: "Community knowledge hub" })}
                  </p>
                  <p lang={lang} className="text-base font-semibold text-navy-500">
                    {knowledgeTotal > 0
                      ? t({
                          th: `ตอนนี้มี ${knowledgeTotal} ชิ้น อ่านฟรีทุกชิ้น`,
                          en: `${knowledgeTotal} pieces, all free to read`,
                        })
                      : t({ th: "งานวิจัยและบทเรียนจาก CBO", en: "Research & lessons from CBOs" })}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {newest.length > 0
                  ? newest.map((k) => (
                      <Link
                        key={k.id}
                        to="/knowledge/$slug"
                        params={{ slug: k.slug }}
                        className="group flex items-center gap-3 rounded-md border border-warm-200 bg-cream p-3 transition-colors hover:border-magenta-300 hover:bg-white"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            lang={lang}
                            className="line-clamp-2 text-sm font-medium text-navy-500 group-hover:text-magenta-700"
                          >
                            {t({ th: k.titleTh, en: k.titleEn || k.titleTh })}
                          </span>
                        </span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-warm-400 transition-transform group-hover:translate-x-0.5 group-hover:text-magenta-500"
                          aria-hidden
                        />
                      </Link>
                    ))
                  : [
                      { th: "งานวิจัยจากชุมชน", en: "Community-led research" },
                      { th: "บทเรียนจากประสบการณ์จริง", en: "Lessons from real experience" },
                      { th: "ความรู้เพื่อการพัฒนา", en: "Knowledge for development" },
                    ].map((l) => (
                      <div
                        key={l.en}
                        className="flex items-center gap-3 rounded-md border border-warm-200 bg-cream p-3"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-magenta-500"
                          aria-hidden
                        />
                        <span lang={lang} className="text-sm font-medium text-navy-500">
                          {t(l)}
                        </span>
                      </div>
                    ))}
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs text-warm-600">
                <Award className="h-4 w-4 text-gold" aria-hidden />
                <span lang={lang}>
                  {t({
                    th: "จัดทำโดย SWING และเครือข่าย CBO",
                    en: "Curated by SWING & CBO partners",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORIES */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10">
          <SectionHeading
            eyebrow={t({ th: "สำรวจคลังความรู้", en: "Explore the knowledge hub" })}
            title={t({
              th: "ความรู้จากชุมชน |บทเรียนจาก CBO",
              en: "Knowledge from the community, lessons from CBOs",
            })}
            intro={t({
              th: "เลือกหมวดที่อยากเริ่ม ทั้งงานวิจัย บทเรียนภาคสนาม สิทธิ และทักษะการทำงานของนักกิจกรรมชุมชน",
              en: "Pick where to start: community research, field lessons, rights & advocacy, or CBO work skills.",
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
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-magenta-500">
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
      </section>

      {/* 3. LATEST KNOWLEDGE (from backend) */}
      {knowledgeItems.length > 0 && (
        <section className="border-y border-warm-200 bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow={t({ th: "คลังความรู้ล่าสุด", en: "Latest knowledge" })}
                title={t({
                  th: "งานวิจัย บทเรียน |และความรู้จากชุมชน",
                  en: "Research, lessons & community knowledge",
                })}
              />
              <Link
                to="/knowledge"
                className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-magenta-500 hover:text-magenta-700"
              >
                {t({ th: `ดูทั้งหมด ${knowledgeTotal} ชิ้น`, en: `See all ${knowledgeTotal}` })}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {knowledgeItems.map((k) => (
                <Link
                  key={k.id}
                  to="/knowledge/$slug"
                  params={{ slug: k.slug }}
                  className={`group flex flex-col overflow-hidden rounded-lg border border-warm-200 bg-cream/40 ${cardLift}`}
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-lavender-100 via-cream to-magenta-100">
                    {k.coverUrl ? (
                      <img
                        src={k.coverUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-lavender-700">
                        <BookOpen className="h-10 w-10 opacity-60" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="line-clamp-3 text-lg font-semibold text-navy-500 group-hover:text-magenta-700">
                      {t({ th: k.titleTh, en: k.titleEn || k.titleTh })}
                    </h3>
                    {k.titleEn && k.titleEn !== k.titleTh && (
                      <p className="mt-1 line-clamp-2 text-xs text-warm-500">
                        {t({ th: k.titleEn, en: k.titleTh })}
                      </p>
                    )}
                    {k.summary && (
                      <p className="mt-3 line-clamp-3 flex-1 text-sm text-warm-600">{k.summary}</p>
                    )}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-magenta-500">
                      {t({ th: "อ่านต่อ", en: "Read" })}
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

      {/* 4. ACCESSIBILITY BAND */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-lg border border-lavender-300 bg-lavender-100/60 p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:items-center">
            <div>
              <p className="eyebrow mb-3">{t({ th: "เพื่อทุกคน", en: "Built for everyone" })}</p>
              <h2
                lang={lang}
                className="text-balance text-2xl font-semibold text-navy-500 md:text-3xl"
              >
                <PhraseText
                  text={t({
                    th: "เรียนได้ทุกที่ |ทุกเวลา |ไม่มีเงื่อนไข",
                    en: "Learn anywhere, anytime, no strings attached",
                  })}
                />
              </h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {ACCESS.map(({ icon: Icon, label }) => (
                <li
                  key={label.en}
                  className="flex items-center gap-3 rounded-md bg-white p-4 shadow-sm"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-lavender-700">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span lang={lang} className="text-sm font-medium text-navy-500">
                    {t(label)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 5. PARTNERS */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8">
          <SectionHeading
            eyebrow={t({ th: "ภาคี", en: "Partners" })}
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

      {/* 6. HELP CALLOUT + FINAL CTA */}
      <section className="relative overflow-hidden bg-navy-500 text-white">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-magenta-500 opacity-20 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-magenta-300">
              {t({ th: "มีคำถามอยู่ใช่ไหม", en: "Got a question?" })}
            </p>
            <h2 lang={lang} className="text-balance text-3xl font-semibold md:text-4xl">
              <PhraseText
                text={t({
                  th: "พร้อมเสมอ |ไม่ว่าคุณจะอยู่ที่ไหน",
                  en: "We're here for you, wherever you are.",
                })}
              />
            </h2>
            <p lang={lang} className="mt-4 max-w-xl text-base text-lavender-300">
              {t({
                th: "ทีมพี่เลี้ยงชุมชนพร้อมรับฟัง ตอบคำถาม และพาคุณไปยังบริการที่ฟรีและเป็นมิตร",
                en: "Our peer educators are ready to listen, answer questions, and connect you with free, friendly services.",
              })}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/courses" className={btnPrimary}>
                {t({ th: "เริ่มเรียน", en: "Start learning" })}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/resources"
                className="inline-flex h-12 items-center gap-2 rounded-pill border border-lavender-300/40 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t({ th: "คลังความรู้", en: "Browse resources" })}
              </Link>
            </div>
          </div>

          <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {HELP.map(({ icon: Icon, label }) => (
              <li key={label.en} className="flex items-center gap-3 border-t border-white/10 pt-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-white/10 text-magenta-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span lang={lang} className="text-sm font-medium">
                  {t(label)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PublicLayout>
  );
}
