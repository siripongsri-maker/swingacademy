import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { KNOWLEDGE_SLUG_ALIASES } from "@/lib/knowledge-slug-aliases";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Globe,
  ListTree,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { DEFAULT_SPONSORS, type Sponsor } from "@/data/knowledge-products-seed";
import { getPublicKnowledgeBySlug } from "@/lib/knowledge.functions";
import { listPublishedTranslationsBySlug } from "@/lib/knowledge-translations.functions";
import { TranslationRenderer } from "@/components/translation-renderer";
import { KnowledgeAnalytics } from "@/components/knowledge-analytics";
import seedData from "@/data/seed-data.json";
import { useQuery } from "@tanstack/react-query";
import { pageHead } from "@/lib/seo";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/knowledge/$slug")({
  beforeLoad: ({ params }) => {
    const target = KNOWLEDGE_SLUG_ALIASES[params.slug];
    if (target && target !== params.slug) {
      throw redirect({
        to: "/knowledge/$slug",
        params: { slug: target },
        replace: true,
      });
    }
  },
  head: ({ params }) =>
    pageHead({
      title: `Knowledge — ${params.slug} | SWING Academy`,
      description: "เนื้อหาสาธารณะจาก SWING Academy",
      path: `/knowledge/${params.slug}`,
    }),
  component: KnowledgeDetailPage,
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">
        โหลดเนื้อหาไม่สำเร็จ: {error.message}
      </div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">ไม่พบเนื้อหานี้</div>
    </PublicLayout>
  ),
});

type Chapter = { id: string; title: string; body: string };

// Split markdown body into chapters by "## " headings. Content before the first
// "## " becomes an "Intro" chapter so nothing is lost.
function splitIntoChapters(md: string): Chapter[] {
  if (!md?.trim()) return [];
  const lines = md.split("\n");
  const chapters: Chapter[] = [];
  let current: Chapter | null = null;
  let intro: string[] = [];
  const slugify = (s: string, i: number) =>
    (s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || `ch-${i}`);

  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) chapters.push(current);
      current = { id: slugify(m[1], chapters.length + 1), title: m[1].trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      intro.push(line);
    }
  }
  if (current) chapters.push(current);
  const introBody = intro.join("\n").trim();
  if (introBody) {
    chapters.unshift({ id: "intro", title: "บทนำ · Introduction", body: introBody });
  }
  return chapters;
}

function KnowledgeDetailPage() {
  const { slug } = Route.useParams();
  const { t, lang } = useLanguage();
  const fetchOne = useServerFn(getPublicKnowledgeBySlug);
  const fetchTrans = useServerFn(listPublishedTranslationsBySlug);
  const { data } = useSuspenseQuery({
    queryKey: ["knowledge", "public", slug],
    queryFn: () => fetchOne({ data: { slug } }),
    staleTime: 60_000,
  });
  const { data: transData } = useQuery({
    queryKey: ["knowledge", "public", "translations", slug],
    queryFn: () => fetchTrans({ data: { slug } }),
    staleTime: 60_000,
  });
  const asset = data.item;
  if (!asset) throw notFound();
  const publishedTranslations = transData?.items ?? [];
  const people = seedData.staffConsole.people as Array<{ id: string; name: string; nameTh: string; role?: string }>;
  const personById = (id: string | null) => people.find((p) => p.id === id);

  const sponsors: Sponsor[] = asset.sponsors.length > 0 ? asset.sponsors : DEFAULT_SPONSORS;
  const chapters = useMemo(() => splitIntoChapters(asset.contentMd), [asset.contentMd]);
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const hasChapters = chapters.length > 0;
  const current = hasChapters ? chapters[Math.min(active, chapters.length - 1)] : null;

  const pdfAttachments = useMemo(
    () =>
      asset.attachments.filter(
        (a) =>
          a.contentType?.toLowerCase().includes("pdf") ||
          a.name?.toLowerCase().endsWith(".pdf"),
      ),
    [asset.attachments],
  );
  const mainPdf = asset.source && asset.sourceType === "pdf" ? { url: asset.source, name: asset.titleTh } : pdfAttachments[0];

  const markComplete = (id: string) => setCompleted((c) => ({ ...c, [id]: true }));
  const goTo = (i: number) => {
    setActive(Math.max(0, Math.min(chapters.length - 1, i)));
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = hasChapters ? Math.round((completedCount / chapters.length) * 100) : 0;


  useEffect(() => {
    if (!modalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoomScale((z) => Math.min(z + 0.25, 3));
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoomScale((z) => Math.max(z - 0.25, 0.5));
      }
      if (e.key === "0") {
        e.preventDefault();
        setZoomScale(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen]);

  return (
    <PublicLayout>
      <article className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-magenta-500"
        >
          <ArrowLeft className="h-4 w-4" />{" "}
          {t({ th: "กลับสู่คลังความรู้", en: "Back to knowledge hub" })}
        </Link>

        {/* Hero */}
        <header className="mt-6 rounded-2xl border border-warm-200 bg-gradient-to-br from-cream via-white to-lavender-50 p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_280px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {asset.visibility === "public" && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-lavender-100 px-2.5 py-1 font-semibold text-lavender-900">
                    <Globe className="h-3 w-3" /> Public Knowledge
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-pill bg-white/70 px-2.5 py-1 font-semibold text-navy-500 ring-1 ring-warm-200">
                  <ShieldCheck className="h-3 w-3" />
                  {asset.status === "published"
                    ? t({ th: "เผยแพร่แล้ว", en: "Published" })
                    : asset.status}
                </span>
                <span className="inline-flex items-center gap-1 rounded-pill bg-white/70 px-2.5 py-1 text-warm-600 ring-1 ring-warm-200">
                  <Calendar className="h-3 w-3" />
                  {new Date(asset.updatedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {hasChapters && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-white/70 px-2.5 py-1 text-warm-600 ring-1 ring-warm-200">
                    <BookOpen className="h-3 w-3" />{" "}
                    {t({
                      th: `${chapters.length} บทเรียน`,
                      en: `${chapters.length} lessons`,
                    })}
                  </span>
                )}
              </div>

              <h1 lang={lang} className="mt-4 max-w-[38ch] text-3xl font-semibold leading-snug text-navy-500 md:text-4xl md:leading-tight">
                {t({ th: asset.titleTh, en: asset.titleEn || asset.titleTh })}
              </h1>
              {asset.titleEn && asset.titleEn !== asset.titleTh && (
                <p className="mt-1 text-base italic text-warm-500">
                  {t({ th: asset.titleEn, en: asset.titleTh })}
                </p>
              )}
              {asset.summary && (
                <p lang={lang} className="mt-4 max-w-[62ch] text-lg leading-8 text-navy-500">
                  {asset.summary}
                </p>
              )}

              {asset.keyMessage && (
                <div className="mt-6 max-w-[62ch] rounded-lg border border-magenta-200 bg-magenta-50 p-4 text-sm text-navy-500">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-magenta-700">
                    {t({ th: "สารสำคัญ", en: "Key message" })}
                  </p>
                  <p lang={lang} className="leading-8">{asset.keyMessage}</p>
                </div>
              )}

              {asset.tags?.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-warm-500">
                  <Tag className="h-3.5 w-3.5" />
                  {asset.tags.map((t) => (
                    <span key={t} className="rounded-pill bg-white/70 px-2 py-0.5 text-navy-500 ring-1 ring-warm-200">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              {asset.source && asset.sourceType === "pdf" && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <a
                    href={asset.source}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-navy-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-600"
                  >
                    <Download className="h-4 w-4" /> ดาวน์โหลด PDF ฉบับเต็ม · Download Full PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setZoomScale(1);
                      setModalOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-navy-500 bg-white px-4 py-2.5 text-sm font-semibold text-navy-500 shadow-sm transition-colors hover:bg-lavender-50"
                  >
                    <Eye className="h-4 w-4" /> ดูตัวอย่างเอกสาร · Preview
                  </button>
                </div>
              )}

              {hasChapters && (
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-warm-500">
                    <span>{t({ th: "ความก้าวหน้าการเรียน", en: "Learning progress" })}</span>
                    <span className="font-semibold text-navy-500">
                      {completedCount}/{chapters.length}{" "}
                      {t({ th: "บท", en: "lessons" })} · {progress}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-warm-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-magenta-500 to-lavender-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {asset.coverUrl && (
              <div className="hidden md:block">
                {asset.source && asset.sourceType === "pdf" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setZoomScale(1);
                      setModalOpen(true);
                    }}
                    className="group block w-full cursor-pointer overflow-hidden rounded-xl border border-warm-200 bg-white shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <img
                      src={asset.coverUrl}
                      alt={`หน้าปก: ${asset.titleTh}`}
                      className="aspect-[3/4] w-full object-cover"
                      loading="lazy"
                    />
                    <div className="flex items-center justify-center gap-1.5 border-t border-warm-200 bg-white/80 px-3 py-2 text-xs font-semibold text-navy-500 group-hover:text-magenta-600">
                      <Eye className="h-3.5 w-3.5" /> คลิกเพื่อดูตัวอย่าง · Click to preview
                    </div>
                  </button>
                ) : (
                  <a
                    href={asset.coverUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-xl border border-warm-200 bg-white shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <img
                      src={asset.coverUrl}
                      alt={`หน้าปก: ${asset.titleTh}`}
                      className="aspect-[3/4] w-full object-cover"
                      loading="lazy"
                    />
                    <div className="flex items-center justify-center gap-1.5 border-t border-warm-200 bg-white/80 px-3 py-2 text-xs font-semibold text-navy-500 group-hover:text-magenta-600">
                      <FileText className="h-3.5 w-3.5" /> หน้าปกเอกสาร
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>
        </header>

        {asset.source && asset.sourceType === "pdf" && (
          <div className="mt-6 rounded-lg border border-dashed border-warm-200 bg-cream/60 px-5 py-3 text-sm text-warm-500">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-magenta-500" />
                มีเอกสารประกอบการเรียนรู้แบบ PDF พร้อมดาวน์โหลด
              </span>
              <a
                href={asset.source}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-600"
              >
                <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
              </a>
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setModalOpen(true);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-navy-500 bg-white px-3 py-1.5 text-xs font-semibold text-navy-500 hover:bg-lavender-50"
              >
                <Eye className="h-3.5 w-3.5" /> ดูตัวอย่าง · Preview
              </button>
            </div>
          </div>
        )}

        {/* Lessons layout */}
        {hasChapters ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Chapter sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-warm-200 bg-white">
                <div className="flex items-center gap-2 border-b border-warm-200 px-4 py-3 text-sm font-semibold text-navy-500">
                  <ListTree className="h-4 w-4 text-magenta-500" />{" "}
                  {t({ th: "สารบัญบทเรียน", en: "Lesson contents" })}
                </div>
                <ol className="max-h-[60vh] overflow-y-auto py-2">
                  {chapters.map((ch, i) => {
                    const isActive = i === active;
                    const isDone = !!completed[ch.id];
                    return (
                      <li key={ch.id}>
                        <button
                          type="button"
                          onClick={() => goTo(i)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-magenta-50 text-magenta-700"
                              : "text-navy-500 hover:bg-warm-50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isDone
                                ? "bg-emerald-500 text-white"
                                : isActive
                                ? "bg-magenta-500 text-white"
                                : "bg-warm-100 text-warm-600"
                            }`}
                          >
                            {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                          </span>
                          <span className="leading-snug">{ch.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </aside>

            {/* Active lesson card */}
            <section className="min-w-0">
              <div className="rounded-xl border border-warm-200 bg-white p-6 md:p-8">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-magenta-600">
                  {t({ th: "บทที่", en: "Lesson" })} {active + 1} / {chapters.length}
                </div>
                <h2 lang={lang} className="mt-2 max-w-[40ch] text-2xl font-semibold leading-snug text-navy-500 md:text-3xl">
                  {current!.title}
                </h2>
                <div
                  lang={lang}
                  className="prose prose-slate mt-6 max-w-[68ch] prose-p:leading-8 prose-li:leading-8 prose-headings:text-navy-500 prose-headings:leading-snug prose-h3:text-lg prose-h3:mt-6 prose-a:text-magenta-600 prose-strong:text-navy-500 prose-table:text-sm prose-th:bg-warm-100 prose-th:p-2 prose-td:p-2 prose-blockquote:border-l-magenta-500 prose-blockquote:bg-cream prose-blockquote:not-italic"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{current!.body}</ReactMarkdown>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-warm-200 pt-6">
                  <button
                    type="button"
                    onClick={() => goTo(active - 1)}
                    disabled={active === 0}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-warm-600 hover:bg-warm-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />{" "}
                    {t({ th: "บทก่อนหน้า", en: "Previous lesson" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markComplete(current!.id);
                      if (active < chapters.length - 1) goTo(active + 1);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-magenta-600"
                  >
                    {completed[current!.id]
                      ? active < chapters.length - 1
                        ? t({ th: "ไปบทถัดไป", en: "Next lesson" })
                        : t({ th: "เรียนจบแล้ว", en: "Completed" })
                      : active < chapters.length - 1
                      ? t({ th: "ทำเครื่องหมายเรียนจบ & บทถัดไป", en: "Mark complete & next" })
                      : t({ th: "ทำเครื่องหมายเรียนจบ", en: "Mark as complete" })}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-warm-200 bg-white px-6 py-12 text-center text-warm-500">
            {t({ th: "ยังไม่มีเนื้อหาบทเรียนสำหรับชิ้นนี้", en: "No lesson content yet for this item." })}
          </div>
        )}

        {publishedTranslations.length > 0 && (
          <section className="mt-14">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-magenta-600">
                  📣 รูปแบบเผยแพร่ · Published Formats
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-navy-500">
                  สื่อจากความรู้ชิ้นนี้
                </h2>
                <p className="mt-1 text-sm text-warm-500">
                  เนื้อหาที่นักแปลความรู้ของ SWING ปรับให้เหมาะกับกลุ่มเป้าหมายต่างๆ
                </p>
              </div>
              <span className="rounded-pill bg-lavender-100 px-2.5 py-1 text-xs font-semibold text-lavender-900">
                {publishedTranslations.length} ชิ้น
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {publishedTranslations.map((t) => {
                const contributor = personById(t.contributorId);
                return (
                  <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-warm-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="rounded-pill bg-magenta-50 px-2 py-0.5 font-semibold text-magenta-700">
                        {t.format}
                      </span>
                      <span className="text-warm-500">{t.audience} · {t.tone}</span>
                    </div>
                    <div className="overflow-hidden rounded-lg">
                      <TranslationRenderer
                        format={t.format}
                        outputMd={t.outputMd}
                        title={t.title}
                        language={t.language}
                        heroImageUrl={t.heroImageUrl}
                      />
                    </div>
                    {contributor && (
                      <div className="mt-1 flex items-center gap-2 border-t border-warm-100 pt-3 text-xs">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-lavender-100 text-xs font-bold text-lavender-900">
                          {contributor.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-navy-500">
                            {contributor.nameTh} <span className="text-warm-500">· {contributor.name}</span>
                          </p>
                          {contributor.role && (
                            <p className="text-warm-500">Contributor · {contributor.role}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <KnowledgeAnalytics slug={asset.slug} knowledgeId={asset.id} />

        {asset.attachments && asset.attachments.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-semibold text-navy-500">เอกสารและไฟล์แนบ · Attachments</h2>
            <ul className="mt-4 divide-y divide-warm-200 overflow-hidden rounded-xl border border-warm-200 bg-white">
              {asset.attachments.map((a) => {
                const sizeLabel =
                  a.size < 1024
                    ? `${a.size} B`
                    : a.size < 1024 * 1024
                    ? `${(a.size / 1024).toFixed(1)} KB`
                    : `${(a.size / 1024 / 1024).toFixed(1)} MB`;
                return (
                  <li key={a.path} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="h-5 w-5 shrink-0 text-magenta-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy-500">{a.name}</p>
                      <p className="text-xs text-warm-500">{sizeLabel} · {a.contentType}</p>
                    </div>
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 rounded-md bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-600"
                      >
                        <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
                      </a>
                    ) : (
                      <span className="text-xs text-warm-400">ลิงก์หมดอายุ</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="mt-14 border-t border-warm-200 pt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-warm-500">
            ผู้สนับสนุนและแหล่งทุน · Supporters & Funders
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {sponsors.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-lg border border-warm-200 bg-white px-4 py-3"
              >
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt={s.name} className="h-8 w-auto object-contain" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-100 text-sm font-bold text-lavender-900">
                    {s.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-navy-500">{s.name}</p>
                  {s.role && <p className="text-xs text-warm-500">{s.role}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-warm-500">
            เผยแพร่โดย SWING Academy · เนื้อหานี้เปิดให้ใช้เพื่อการศึกษาและการพัฒนาบริการของชุมชน
          </p>
        </footer>

        {/* Full-screen PDF Preview Modal */}
        {modalOpen && asset.source && asset.sourceType === "pdf" && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Maximize className="h-4 w-4 text-magenta-400" />
                <span className="truncate max-w-[200px] sm:max-w-md">{asset.titleTh}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Zoom out */}
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(z - 0.25, 0.5))}
                  disabled={zoomScale <= 0.5}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                  title="ซูมออก · Zoom out"
                >
                  <Minus className="h-4 w-4" />
                </button>
                {/* Reset zoom */}
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
                  title="รีเซ็ต · Reset"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{Math.round(zoomScale * 100)}%</span>
                </button>
                {/* Zoom in */}
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(z + 0.25, 3))}
                  disabled={zoomScale >= 3}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                  title="ซูมเข้า · Zoom in"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <div className="mx-1 h-5 w-px bg-white/20" />
                {/* Download */}
                <a
                  href={asset.source}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-navy-500 px-3 text-xs font-semibold text-white transition hover:bg-navy-600"
                >
                  <Download className="h-3.5 w-3.5" /> ดาวน์โหลด
                </a>
                {/* Close */}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20"
                  title="ปิด · Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* PDF viewport */}
            <div className="flex-1 overflow-auto">
              <div
                className="flex min-h-full items-start justify-center p-6"
                style={{ cursor: zoomScale > 1 ? "grab" : "default" }}
              >
                <div
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "top center",
                    transition: "transform 0.2s ease-out",
                    width: "100%",
                    maxWidth: "1024px",
                  }}
                >
                  <object
                    data={`${asset.source}#view=FitH`}
                    type="application/pdf"
                    className="h-[85vh] w-full rounded-md bg-white shadow-2xl"
                  >
                    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center text-white">
                      <p className="text-sm opacity-80">เบราว์เซอร์ของคุณไม่รองรับการแสดง PDF ในหน้าเว็บ</p>
                      <a
                        href={asset.source}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-navy-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-600"
                      >
                        <Download className="h-4 w-4" /> ดาวน์โหลด PDF
                      </a>
                    </div>
                  </object>
                </div>
              </div>
            </div>
          </div>
        )}
      </article>
    </PublicLayout>
  );
}
