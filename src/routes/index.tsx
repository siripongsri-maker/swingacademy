import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  Heart,
  Scale,
  Sparkles,
  Sun,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  WifiOff,
  Smartphone,
  Award,
  MapPin,
  BookOpen,
  HelpCircle,
  Globe,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import seed from "@/data/seed-data.json";
import { pageHead } from "@/lib/seo";
import { listPublicKnowledge } from "@/lib/knowledge.functions";
import { HomepageVisitCounter } from "@/components/homepage-visit-counter";

const knowledgeQueryOptions = queryOptions({
  queryKey: ["knowledge", "public", "all"],
  queryFn: () => listPublicKnowledge(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "SWING Academy — Free bilingual learning on sexual health & rights",
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


const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  heart: Heart,
  scale: Scale,
  sparkles: Sparkles,
  sun: Sun,
};

type Category = { id: string; icon: string; color: string; name: Localized; blurb: Localized };
type Partner = { id: string; short: string; color: string; role: Localized };

const REASSURE: { icon: typeof HeartHandshake; label: Localized }[] = [
  { icon: HeartHandshake, label: { th: "ฟรีเสมอ", en: "Always free" } },
  { icon: ShieldCheck, label: { th: "ไม่ต้องใช้บัตรประชาชน", en: "No ID required" } },
  { icon: ShieldCheck, label: { th: "เป็นความลับ", en: "Private & confidential" } },
  { icon: Heart, label: { th: "ไม่มีการตัดสิน", en: "No judgment" } },
];


function HomePage() {
  const { t, lang } = useLanguage();
  const categories = seed.publicPortal.categories as Category[];
  const partners = seed.publicPortal.partners as Partner[];
  const { data: knowledgeData } = useSuspenseQuery(knowledgeQueryOptions);
  const knowledgeItems = knowledgeData.items.slice(0, 6);

  return (
    <PublicLayout>
      {/* 1. HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-magenta-100 blur-3xl opacity-60"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-lavender-100 blur-3xl opacity-70"
        />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 md:pt-24 md:pb-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="eyebrow mb-5">
              {t({ th: "ยินดีต้อนรับสู่ SWING Academy", en: "Welcome to SWING Academy" })}
            </p>
            <h1
              lang={lang}
              className="text-4xl font-semibold text-navy-500 md:text-5xl lg:text-6xl"
            >
              {t({
                th: "เรียนรู้ ดูแลตัวเอง และเคารพในสิทธิ์ของเรา",
                en: "Learn, care for yourself, and know your rights.",
              })}
            </h1>
            <p lang={lang} className="mt-5 max-w-xl text-lg text-warm-500">
              {t({
                th: "พื้นที่เรียนรู้ฟรี อบอุ่น และเป็นมิตร สำหรับชุมชนของเรา — สุขภาพทางเพศ สิทธิ ทักษะชีวิต และการดูแลใจ",
                en: "A free, warm, judgement-free learning space for our communities — sexual health, rights, life skills, and wellbeing.",
              })}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {REASSURE.map(({ icon: Icon, label }) => (
                <span
                  key={label.en}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-500"
                >
                  <Icon className="h-3.5 w-3.5 text-magenta-500" />
                  <span lang={lang}>{t(label)}</span>
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
              >
                {t({ th: "เริ่มเรียนเลย", en: "Start learning" })}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-pill border border-navy-300 bg-white px-6 py-3 text-sm font-semibold text-navy-500 transition-all hover:border-navy-500"
              >
                {t({ th: "ดูคอร์สทั้งหมด", en: "Browse courses" })}
              </Link>
            </div>

            <HomepageVisitCounter />
          </div>

          {/* Soft illustrative card */}
          <div className="relative">
            <div className="pride-gradient absolute -inset-2 rounded-lg opacity-15 blur-2xl" aria-hidden />
            <div className="relative rounded-lg border border-warm-200 bg-white p-7 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-magenta-100 text-magenta-500">
                  <BookOpen className="h-6 w-6" />
                </span>
                <div>
                  <p className="eyebrow">
                    {t({ th: "คลังความรู้จากชุมชน", en: "Community knowledge hub" })}
                  </p>
                  <p lang={lang} className="text-base font-semibold text-navy-500">
                    {t({ th: "งานวิจัยและบทเรียนจาก CBO", en: "Research & lessons from CBOs" })}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  { th: "งานวิจัยจากชุมชน", en: "Community-led research" },
                  { th: "บทเรียนจากประสบการณ์จริง", en: "Lessons from real experience" },
                  { th: "ความรู้เพื่อการพัฒนา", en: "Knowledge for development" },
                ].map((l, i) => (
                  <div
                    key={l.en}
                    className="flex items-center gap-3 rounded-md border border-warm-200 bg-cream p-3"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-white text-xs font-bold text-magenta-500">
                      {i + 1}
                    </span>
                    <span lang={lang} className="text-sm font-medium text-navy-500">
                      {t(l)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs text-warm-500">
                <Award className="h-4 w-4 text-gold" />
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

      {/* 3. CATEGORIES — community knowledge / CBO theme */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">
              {t({ th: "สำรวจคลังความรู้", en: "Explore the knowledge hub" })}
            </p>
            <h2 lang={lang} className="text-3xl font-semibold text-navy-500 md:text-4xl">
              {t({
                th: "ความรู้จากชุมชน บทเรียนจาก CBO",
                en: "Knowledge from the community, lessons from CBOs",
              })}
            </h2>
            <p lang={lang} className="mt-3 text-base text-warm-500">
              {t({
                th: "เลือกหมวดที่อยากเริ่ม ทั้งงานวิจัย บทเรียนภาคสนาม สิทธิและทักษะการทำงานของนักกิจกรรมชุมชน",
                en: "Pick a path — community research, field lessons, rights & advocacy, or CBO work skills.",
              })}
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {([
            {
              id: "research",
              icon: BookOpen,
              color: "#CC0099",
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
              color: "#7A6FC4",
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
              color: "#C9A227",
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
              color: "#1F8A5B",
              name: { th: "ทักษะการทำงาน CBO", en: "CBO work skills" },
              blurb: {
                th: "คอร์สและบทเรียนสำหรับนักกิจกรรมและทีมงานชุมชน",
                en: "Courses & lessons for community organisers and staff",
              },
              to: "/courses" as const,
              cta: { th: "ไปที่คอร์ส", en: "Go to courses" },
            },
          ] as const).map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                to={cat.to}
                className="group flex flex-col rounded-md border border-warm-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
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
                <p lang={lang} className="mt-2 flex-1 text-sm text-warm-500">
                  {t(cat.blurb)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-magenta-500">
                  {t(cat.cta)}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/knowledge"
            className="inline-flex items-center gap-2 rounded-pill bg-navy-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-navy-700"
          >
            {t({ th: "เปิดคลังความรู้ทั้งหมด", en: "Open the knowledge hub" })}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-pill border border-navy-300 bg-white px-6 py-3 text-sm font-semibold text-navy-500 transition-all hover:border-navy-500"
          >
            {t({ th: "ดูคอร์สและบทเรียน", en: "See courses & lessons" })}
          </Link>
        </div>
      </section>


      {/* 7. ACCESSIBILITY BAND */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-lg border border-lavender-300 bg-lavender-100/60 p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:items-center">
            <div>
              <p className="eyebrow mb-3">{t({ th: "เพื่อทุกคน", en: "Built for everyone" })}</p>
              <h2 lang={lang} className="text-2xl font-semibold text-navy-500 md:text-3xl">
                {t({
                  th: "เรียนได้ทุกที่ ทุกเวลา ไม่มีเงื่อนไข",
                  en: "Learn anywhere, anytime, no strings attached",
                })}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: Smartphone,
                  th: "เปิดในมือถือได้ดี",
                  en: "Mobile-friendly",
                },
                {
                  icon: WifiOff,
                  th: "ดาวน์โหลดอ่านออฟไลน์ได้",
                  en: "Works offline",
                },
                {
                  icon: ShieldCheck,
                  th: "เป็นความลับเสมอ",
                  en: "Always private",
                },
              ].map(({ icon: Icon, th, en }) => (
                <div
                  key={en}
                  className="flex items-start gap-3 rounded-md bg-white p-4 shadow-sm"
                >
                  <Icon className="h-5 w-5 shrink-0 text-lavender-700" />
                  <p lang={lang} className="text-sm font-medium text-navy-500">
                    {t({ th, en })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. PARTNERS */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow mb-3">{t({ th: "พันธมิตร", en: "Partners" })}</p>
          <h2 lang={lang} className="text-2xl font-semibold text-navy-500 md:text-3xl">
            {t({ th: "ร่วมเดินทางไปด้วยกัน", en: "Walking with us" })}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {partners.map((p) => (
            <div
              key={p.id}
              className="rounded-md border border-warm-200 bg-white p-4 text-center shadow-sm"
            >
              <div
                className="mx-auto mb-2 h-1 w-10 rounded-pill"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <p className="text-sm font-semibold text-navy-500">{p.short}</p>
              <p lang={lang} className="mt-1 text-xs text-warm-500">
                {t(p.role)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 8b. KNOWLEDGE PRODUCTS (from backend) */}
      {knowledgeItems.length > 0 && (
        <section className="bg-cream py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-3">
                  {t({ th: "คลังความรู้ล่าสุด", en: "Latest knowledge" })}
                </p>
                <h2 lang={lang} className="text-3xl font-semibold text-navy-500 md:text-4xl">
                  {t({
                    th: "งานวิจัย บทเรียน และความรู้จากชุมชน",
                    en: "Research, lessons & community knowledge",
                  })}
                </h2>
              </div>
              <Link
                to="/knowledge"
                className="inline-flex items-center gap-1 text-sm font-semibold text-magenta-500 hover:text-magenta-700"
              >
                {t({ th: "ดูทั้งหมด", en: "See all" })}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {knowledgeItems.map((k) => (
                <Link
                  key={k.id}
                  to="/knowledge/$slug"
                  params={{ slug: k.slug }}
                  className="group flex flex-col rounded-lg border border-warm-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-lavender-100 text-lavender-900">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold text-navy-500 group-hover:text-magenta-500">
                    {t({ th: k.titleTh, en: k.titleEn || k.titleTh })}
                  </h3>
                  {k.titleEn && k.titleEn !== k.titleTh && (
                    <p className="mt-0.5 text-xs italic text-warm-500">
                      {t({ th: k.titleEn, en: k.titleTh })}
                    </p>
                  )}
                  {k.summary && (
                    <p className="mt-3 line-clamp-3 flex-1 text-sm text-warm-600">{k.summary}</p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-warm-500">
                    <Globe className="h-3 w-3" /> Public Knowledge
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 9. HELP CALLOUT + FINAL CTA */}
      <section className="bg-navy-500 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-magenta-300">
              {t({ th: "ต้องการความช่วยเหลือ?", en: "Need help?" })}
            </p>
            <h2 lang={lang} className="text-3xl font-semibold md:text-4xl">
              {t({
                th: "พร้อมเสมอ ไม่ว่าคุณจะอยู่ที่ไหน",
                en: "We're here for you, wherever you are.",
              })}
            </h2>
            <p lang={lang} className="mt-4 max-w-xl text-base text-lavender-300">
              {t({
                th: "ทีมพี่เลี้ยงชุมชนของเราพร้อมรับฟัง ตอบคำถาม และพาคุณไปยังบริการที่ฟรีและเป็นมิตร",
                en: "Our peer educators are ready to listen, answer questions, and connect you with free, friendly services.",
              })}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
              >
                {t({ th: "เริ่มเรียน", en: "Start learning" })}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/resources"
                className="inline-flex items-center gap-2 rounded-pill border border-lavender-300/40 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
              >
                {t({ th: "คลังความรู้", en: "Browse resources" })}
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: HelpCircle, th: "คุยกับพี่เลี้ยงชุมชน", en: "Talk to a peer educator" },
              { icon: MapPin, th: "ค้นหาบริการใกล้บ้าน", en: "Find services near you" },
              { icon: BookOpen, th: "เรียนรู้ด้วยตัวเอง", en: "Self-paced learning" },
              { icon: Award, th: "รับใบประกาศ", en: "Earn certificates" },
            ].map(({ icon: Icon, th, en }) => (
              <div
                key={en}
                className="flex items-start gap-3 rounded-md bg-navy-700/60 p-4 ring-1 ring-white/10"
              >
                <Icon className="h-5 w-5 shrink-0 text-magenta-300" />
                <p lang={lang} className="text-sm font-medium">
                  {t({ th, en })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
