import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Globe,
  ListTree,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { DEFAULT_SPONSORS, type Sponsor } from "@/data/knowledge-products-seed";
import { getPublicKnowledgeBySlug } from "@/lib/knowledge.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/knowledge/$slug")({
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
  const fetchOne = useServerFn(getPublicKnowledgeBySlug);
  const { data } = useSuspenseQuery({
    queryKey: ["knowledge", "public", slug],
    queryFn: () => fetchOne({ data: { slug } }),
    staleTime: 60_000,
  });
  const asset = data.item;
  if (!asset) throw notFound();

  const sponsors: Sponsor[] = asset.sponsors.length > 0 ? asset.sponsors : DEFAULT_SPONSORS;
  const chapters = useMemo(() => splitIntoChapters(asset.contentMd), [asset.contentMd]);
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const hasChapters = chapters.length > 0;
  const current = hasChapters ? chapters[Math.min(active, chapters.length - 1)] : null;

  const markComplete = (id: string) => setCompleted((c) => ({ ...c, [id]: true }));
  const goTo = (i: number) => {
    setActive(Math.max(0, Math.min(chapters.length - 1, i)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = hasChapters ? Math.round((completedCount / chapters.length) * 100) : 0;

  return (
    <PublicLayout>
      <article className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-magenta-500"
        >
          <ArrowLeft className="h-4 w-4" /> กลับสู่คลังความรู้
        </Link>

        {/* Hero */}
        <header className="mt-6 rounded-2xl border border-warm-200 bg-gradient-to-br from-cream via-white to-lavender-50 p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {asset.visibility === "public" && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-lavender-100 px-2.5 py-1 font-semibold text-lavender-900">
                <Globe className="h-3 w-3" /> Public Knowledge
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-pill bg-white/70 px-2.5 py-1 font-semibold text-navy-500 ring-1 ring-warm-200">
              <ShieldCheck className="h-3 w-3" />
              {asset.status === "published" ? "เผยแพร่แล้ว" : asset.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-pill bg-white/70 px-2.5 py-1 text-warm-600 ring-1 ring-warm-200">
              <Calendar className="h-3 w-3" />
              {new Date(asset.updatedAt).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {hasChapters && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-white/70 px-2.5 py-1 text-warm-600 ring-1 ring-warm-200">
                <BookOpen className="h-3 w-3" /> {chapters.length} บทเรียน
              </span>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-navy-500 md:text-4xl">{asset.titleTh}</h1>
          {asset.titleEn && <p className="mt-1 text-base italic text-warm-500">{asset.titleEn}</p>}
          {asset.summary && (
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-navy-500">{asset.summary}</p>
          )}

          {asset.keyMessage && (
            <div className="mt-6 rounded-lg border border-magenta-200 bg-magenta-50 p-4 text-sm text-navy-500">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-magenta-700">สารสำคัญ</p>
              <p className="leading-relaxed">{asset.keyMessage}</p>
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

          {hasChapters && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-warm-500">
                <span>ความก้าวหน้าการเรียน</span>
                <span className="font-semibold text-navy-500">
                  {completedCount}/{chapters.length} บท · {progress}%
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
        </header>

        {/* Lessons layout */}
        {hasChapters ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Chapter sidebar */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-warm-200 bg-white">
                <div className="flex items-center gap-2 border-b border-warm-200 px-4 py-3 text-sm font-semibold text-navy-500">
                  <ListTree className="h-4 w-4 text-magenta-500" /> สารบัญบทเรียน
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
                  บทที่ {active + 1} / {chapters.length}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-navy-500 md:text-3xl">
                  {current!.title}
                </h2>
                <div className="prose prose-slate mt-6 max-w-none prose-headings:text-navy-500 prose-h3:text-lg prose-h3:mt-6 prose-a:text-magenta-600 prose-strong:text-navy-500 prose-table:text-sm prose-th:bg-warm-100 prose-th:p-2 prose-td:p-2 prose-blockquote:border-l-magenta-500 prose-blockquote:bg-cream prose-blockquote:not-italic">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{current!.body}</ReactMarkdown>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-warm-200 pt-6">
                  <button
                    type="button"
                    onClick={() => goTo(active - 1)}
                    disabled={active === 0}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-warm-600 hover:bg-warm-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> บทก่อนหน้า
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
                        ? "ไปบทถัดไป"
                        : "เรียนจบแล้ว"
                      : active < chapters.length - 1
                      ? "ทำเครื่องหมายเรียนจบ & บทถัดไป"
                      : "ทำเครื่องหมายเรียนจบ"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-warm-200 bg-white px-6 py-12 text-center text-warm-500">
            ยังไม่มีเนื้อหาบทเรียนสำหรับชิ้นนี้
          </div>
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
      </article>
    </PublicLayout>
  );
}
