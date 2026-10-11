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
  MapPin,
  BookOpen,
  Languages,
  Library,
  MessageCircle,
  Route as RouteIcon,
  Mic,
  Settings2,
  Network,
  KeyRound,
  DoorOpen,
  RefreshCw,
  Search,
  CircleCheck,
  Hand,
  Quote,
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
      title: "SWING Academy · Community knowledge you can find and trust",
      description:
        "Free Thai and English lessons from frontline community workers on sexual health, rights and work skills. A two-check review (accurate and dignified) is in development.",
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

// CVSK: Community Voice to Structured Knowledge, four layers.
const JOURNEY: {
  icon: typeof Mic;
  tone: string;
  title: Localized;
  body: Localized;
}[] = [
  {
    icon: Mic,
    tone: "bg-dignity-soft text-dignity-ink",
    title: { th: "เล่าจากหน้างาน", en: "Told from the frontline" },
    body: {
      th: "คนทำงานเล่าวิธีที่ใช้ได้จริง ด้วยเสียงหรือข้อความ โดยเจ้าของเรื่องยินยอมก่อนทุกครั้ง",
      en: "People doing the work share what works, by voice or text, always with their consent first.",
    },
  },
  {
    icon: Settings2,
    tone: "bg-warm-100 text-warm-700",
    title: { th: "ถอดเสียง ปกปิดตัวตน", en: "Transcribed and de-identified" },
    body: {
      th: "ถอดเสียงเป็นข้อความ ลบชื่อและรายละเอียดที่ชี้ตัวคนเล่าได้ แล้วแยกเป็นหน่วยความรู้ทีละเรื่อง",
      en: "Speech becomes text, names and identifying details are removed, and it is split into knowledge units.",
    },
  },
  {
    icon: Network,
    tone: "bg-accuracy-soft text-accuracy-ink",
    title: { th: "จัดให้ค้นเจอ", en: "Organised to be found" },
    body: {
      th: "จัดหมวด ผูกกับทักษะการทำงาน และย้อนกลับไปดูแหล่งที่มาได้",
      en: "Tagged, linked to work skills, and always traceable to its source.",
    },
  },
  {
    icon: ShieldCheck,
    tone: "bg-navy-100 text-navy-500",
    title: { th: "ตรวจสองด้าน", en: "Checked two ways" },
    body: {
      th: "ผู้เชี่ยวชาญดูว่าถูกต้องไหม ชุมชนร่วมประเมินว่าให้เกียรติคนหรือเปล่า ผ่านครบสองด้านถึงจะเผยแพร่",
      en: "Experts check it is accurate, and the community co-assesses whether it treats people with dignity. Only then is it published.",
    },
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
      th: "ถอดบทเรียนจากงานจริงขององค์กรชุมชน (CBO) และพี่เลี้ยงชุมชน",
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

/** Illustrates one knowledge unit passing both keys. Fictional example, labelled as such. */
function SampleUnitCard() {
  const { t, lang } = useLanguage();
  return (
    <figure
      className="relative"
      aria-label={t({
        th: "ตัวอย่างสมมติของหน่วยความรู้ที่ผ่านกุญแจสองดอก ระบบนี้กำลังพัฒนา",
        en: "Fictional example of a knowledge unit passing both keys. This process is in development.",
      })}
    >
      <div
        aria-hidden
        className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-accuracy-soft via-white to-dignity-soft opacity-80 blur-xl"
      />
      <div className="relative overflow-hidden rounded-lg border border-warm-200 bg-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warm-200 px-6 py-3">
          <span className="text-xs font-semibold whitespace-nowrap uppercase tracking-[0.12em] text-warm-600">
            {t({ th: "หน่วยความรู้", en: "Knowledge unit" })}
          </span>
          <span className="rounded-pill border border-warm-400 bg-white px-2.5 py-0.5 text-xs whitespace-nowrap font-semibold text-warm-700">
            {t({ th: "ตัวอย่างสมมติ · ระบบกำลังพัฒนา", en: "Fictional · in development" })}
          </span>
        </div>

        <div className="px-6 pt-5 pb-6">
          <Quote className="h-6 w-6 text-dignity" aria-hidden />
          <p lang={lang} className="mt-2 text-lg font-semibold leading-snug text-navy-500">
            {t({
              th: "เปิดบทสนทนาเรื่องการตรวจเอชไอวีอย่างไร กับคนที่เคยเจอบริการที่ไม่เป็นมิตร",
              en: "How to start a conversation about HIV testing with someone who has met unfriendly services",
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-warm-600">
            <span className="inline-flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {t({
                th: "เล่าจากประสบการณ์พี่เลี้ยงชุมชน",
                en: "From a peer educator's experience",
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {t({ th: "ลบข้อมูลระบุตัวตนแล้ว", en: "De-identified" })}
            </span>
          </div>

          <ul className="mt-5 space-y-2.5">
            <li className="flex items-center gap-3 rounded-md bg-accuracy-soft/70 px-3.5 py-3">
              <KeyRound className="h-5 w-5 shrink-0 text-accuracy" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-accuracy-ink">
                  {t({ th: "ถูกต้อง · ตรงกับที่มา", en: "Accurate · true to source" })}
                </span>
                <span className="block text-xs text-accuracy-ink">
                  {t({ th: "ผู้เชี่ยวชาญตรวจแล้ว", en: "Checked by experts" })}
                </span>
              </span>
              <CircleCheck className="h-5 w-5 shrink-0 text-accuracy" aria-hidden />
            </li>
            <li className="flex items-center gap-3 rounded-md bg-dignity-soft/80 px-3.5 py-3">
              <KeyRound className="h-5 w-5 shrink-0 text-dignity-ink" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-dignity-ink">
                  {t({ th: "ให้เกียรติ · ไม่ตีตรา", en: "Dignified · non-stigmatising" })}
                </span>
                <span className="block text-xs text-dignity-ink">
                  {t({ th: "ชุมชนร่วมประเมินแล้ว", en: "Co-assessed by the community" })}
                </span>
              </span>
              <CircleCheck className="h-5 w-5 shrink-0 text-dignity-ink" aria-hidden />
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2.5 bg-navy-500 px-6 py-3.5 text-sm font-semibold text-white">
          <DoorOpen className="h-4 w-4 text-dignity" aria-hidden />
          {t({
            th: "เมื่อผ่านทั้งสองด้าน จึงจะเผยแพร่ในคลัง",
            en: "When both keys pass, it can go in the library",
          })}
        </div>
      </div>
    </figure>
  );
}

function TwoKeyMatrix() {
  const { t } = useLanguage();
  const cell = "flex flex-col justify-between gap-2 rounded-md p-3.5 sm:p-4";
  return (
    <figure
      className="relative pl-7 pb-7"
      aria-label={t({
        th: "ตารางสองด้าน ถูกต้องกับให้เกียรติ ต้องผ่านทั้งคู่ถึงจะเผยแพร่ได้",
        en: "Two-by-two grid: content must be both accurate and dignified to be published.",
      })}
    >
      <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-2.5">
        <div className={`${cell} bg-accuracy-soft text-accuracy-ink`}>
          <span className="text-xs font-semibold sm:text-sm">
            {t({ th: "ให้เกียรติ แต่ไม่ถูกต้อง", en: "Dignified, but inaccurate" })}
          </span>
          <span className="text-xs">
            {t({ th: "แก้ก่อนเผยแพร่", en: "Fix before publishing" })}
          </span>
        </div>
        <div className={`${cell} bg-navy-500 text-white shadow-lg ring-4 ring-dignity/40`}>
          <DoorOpen className="h-6 w-6 text-dignity" aria-hidden />
          <span>
            <span className="block text-base font-semibold sm:text-lg">
              {t({ th: "เผยแพร่ได้", en: "Ready to publish" })}
            </span>
            <span className="block text-xs text-lavender-300">
              {t({ th: "ได้กุญแจครบสองดอก", en: "Both keys pass" })}
            </span>
          </span>
        </div>
        <div className={`${cell} bg-warm-100 text-warm-700`}>
          <Lock className="h-5 w-5" aria-hidden />
          <span>
            <span className="block text-xs font-semibold sm:text-sm">
              {t({ th: "พักไว้ก่อน", en: "On hold" })}
            </span>
            <span className="block text-xs">
              {t({ th: "ยังไม่ผ่านทั้งสองด้าน", en: "Neither key passes yet" })}
            </span>
          </span>
        </div>
        <div className={`${cell} bg-dignity-soft text-dignity-ink`}>
          <span className="text-xs font-semibold sm:text-sm">
            {t({ th: "ถูกต้อง แต่ตีตรา", en: "Accurate, but stigmatising" })}
          </span>
          <span className="text-xs">
            {t({ th: "แก้ก่อนเผยแพร่", en: "Fix before publishing" })}
          </span>
        </div>
      </div>

      {/* Axes */}
      <div
        aria-hidden
        className="absolute top-0 bottom-7 left-0 flex w-5 items-center justify-center"
      >
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-dignity" />
        <span className="relative -rotate-90 whitespace-nowrap bg-cream px-2 text-xs font-semibold text-dignity-ink">
          {/* The label is rotated -90deg, so a right arrow points up the axis */}
          {t({ th: "ให้เกียรติ →", en: "Dignified →" })}
        </span>
      </div>
      <div
        aria-hidden
        className="absolute right-0 bottom-0 left-7 flex h-5 items-center justify-center"
      >
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accuracy" />
        <span className="relative bg-cream px-2 text-xs font-semibold text-accuracy-ink">
          {t({ th: "ถูกต้อง →", en: "Accurate →" })}
        </span>
      </div>
    </figure>
  );
}

function HomePage() {
  const { t, lang } = useLanguage();
  const partners = seed.publicPortal.partners as Partner[];
  const { total: knowledgeTotal, items: knowledgeItems } = Route.useLoaderData();

  return (
    <PublicLayout flushFooter>
      {/* 1. HERO: search the library, and see what a checked knowledge unit looks like */}
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
            <p className={eyebrow}>SWING Academy · Community Voice to Structured Knowledge</p>
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
            <SampleUnitCard />
          </div>
        </div>
      </section>

      {/* 2. THE JOURNEY: CVSK's four layers */}
      <section className="border-y border-warm-200 bg-white py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            center
            kicker={t({
              th: "เส้นทางของความรู้ · กำลังพัฒนา",
              en: "How knowledge gets here · in development",
            })}
            title={t({
              th: "จากเสียงหน้างาน |สู่ความรู้ที่ใครก็ค้นเจอ",
              en: "From frontline voices to knowledge you can find",
            })}
            intro={t({
              th: "แนวทางที่ SWING Academy กำลังพัฒนา: AI ช่วยทำงานด่านแรก และคนตรวจก่อนเผยแพร่ทุกครั้ง เพื่อให้ความรู้ยังอยู่ แม้คนทำงานจะย้ายไป",
              en: "The approach SWING Academy is building: AI does the first pass, and people review before anything is published, so know-how stays when people move on.",
            })}
          />

          <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map((step, i) => {
              const Icon = step.icon;
              const isReview = i === JOURNEY.length - 1;
              return (
                <li
                  key={step.title.en}
                  className="relative flex flex-col rounded-lg border border-warm-200 bg-cream/50 p-6"
                >
                  {isReview ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 flex h-1.5 overflow-hidden rounded-t-[23px]"
                    >
                      <span className="flex-1 bg-accuracy" />
                      <span className="flex-1 bg-dignity" />
                    </span>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-md ${step.tone}`}
                    >
                      <Icon className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="text-3xl font-semibold text-warm-500" aria-hidden>
                      {i + 1}
                    </span>
                  </div>
                  <h3 lang={lang} className="mt-5 text-lg font-semibold text-navy-500">
                    <span className="sr-only">{i + 1}. </span>
                    {t(step.title)}
                  </h3>
                  <p lang={lang} className="mt-2 text-sm text-warm-600">
                    {t(step.body)}
                  </p>
                  {i < JOURNEY.length - 1 && (
                    <ArrowRight
                      aria-hidden
                      className="absolute top-1/2 -right-4 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white text-warm-400 lg:block"
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <p className="flex items-center gap-3 rounded-md border border-dashed border-dignity/60 bg-dignity-soft/40 px-4 py-3 text-sm text-dignity-ink">
              <RefreshCw className="h-5 w-5 shrink-0" aria-hidden />
              <span lang={lang}>
                {t({
                  th: "ผู้ตรวจแก้ตรงไหน ระบบจะเอาไปปรับในรอบถัดไป",
                  en: "Wherever reviewers correct something, the system uses it to improve the next round.",
                })}
              </span>
            </p>
            <p className="flex items-center gap-3 rounded-md border border-dashed border-accuracy/50 bg-accuracy-soft/40 px-4 py-3 text-sm text-accuracy-ink">
              <MapPin className="h-5 w-5 shrink-0" aria-hidden />
              <span lang={lang}>
                {t({
                  th: "ออกแบบให้ใช้โมเดลภาษาไทยแบบ open-weight และประมวลผลในประเทศ",
                  en: "Designed around open-weight Thai language models, processed in-country.",
                })}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 3. TWO KEYS: accurate AND dignified, neither can make up for the other */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <SectionHeading
              kicker={t({
                th: "ประตูหนึ่งบาน กุญแจสองดอก · กำลังพัฒนา",
                en: "One door, two keys · in development",
              })}
              title={t({
                th: "ความรู้จะขึ้นคลังได้ |ก็ต่อเมื่อผ่านครบสองด้าน",
                en: "Knowledge goes live only when it passes both checks",
              })}
            />

            <div className="mt-8 space-y-4">
              <div className="flex gap-4 rounded-lg border border-accuracy/25 bg-white p-5 shadow-sm">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-accuracy text-white">
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 lang={lang} className="font-semibold text-accuracy-ink">
                    {t({ th: "ถูกต้อง · ตรงกับที่มา", en: "Accurate · true to source" })}
                  </h3>
                  <p lang={lang} className="mt-1 text-sm text-warm-600">
                    {t({
                      th: "ผู้เชี่ยวชาญตรวจว่าเนื้อหาถูกต้อง และย้อนกลับไปดูที่มาได้",
                      en: "Experts check the content is correct and can be traced back to its source.",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 rounded-lg border border-dignity/40 bg-white p-5 shadow-sm">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-dignity text-navy-900">
                  <KeyRound className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 lang={lang} className="font-semibold text-dignity-ink">
                    {t({ th: "ให้เกียรติ · ไม่ตีตรา", en: "Dignified · non-stigmatising" })}
                  </h3>
                  <p lang={lang} className="mt-1 text-sm text-warm-600">
                    {t({
                      th: "พี่เลี้ยงชุมชนเป็นผู้ประเมินหลัก ร่วมกับนักสิทธิมนุษยชน พยาบาล และแพทย์ประจำคลินิก ทุกคนทำงานกับชุมชนอยู่แล้ว",
                      en: "Peer educators lead this check, with human rights advocates, nurses and a clinic doctor. Everyone on the panel works with the community.",
                    })}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 flex items-start gap-3 text-sm text-navy-500">
              <Hand className="mt-0.5 h-5 w-5 shrink-0 text-dignity-ink" aria-hidden />
              <span lang={lang}>
                {t({
                  th: "ด้านหนึ่งชดเชยอีกด้านไม่ได้ เนื้อหาถูกต้องครบ แต่ใช้ภาษาตีตรา ก็ยังเผยแพร่ไม่ได้",
                  en: "One cannot make up for the other. Fully accurate content written in stigmatising language still cannot be published.",
                })}
              </span>
            </p>
          </div>

          <div className="mx-auto w-full max-w-md">
            <TwoKeyMatrix />
          </div>
        </div>
      </section>

      {/* 4. LATEST KNOWLEDGE (from backend) */}
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
                intro={t({
                  th: "เรื่องในคลังตอนนี้ SWING และภาคีเผยแพร่ก่อนจะมีการตรวจสองด้าน ซึ่งยังอยู่ระหว่างพัฒนา",
                  en: "These items from SWING and partners were published before the two-key review, which is still in development.",
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

      {/* 5. CATEGORIES */}
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

      {/* 6. PARTNERS */}
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

      {/* 7. HELP CALLOUT + FINAL CTA */}
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
