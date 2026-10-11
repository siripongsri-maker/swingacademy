import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, BookOpen, Search, X } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { RouteError, RouteNotFound } from "@/components/route-fallback";
import { listPublicKnowledge, type KnowledgeRow } from "@/lib/knowledge.functions";
import { useLanguage } from "@/lib/language-context";
import { pageHead } from "@/lib/seo";

type KnowledgeSearch = { q?: string };

export const Route = createFileRoute("/knowledge/")({
  validateSearch: (search: Record<string, unknown>): KnowledgeSearch => {
    // The default search parser turns ?q=2567 into a number, so accept numbers too.
    const raw = search.q;
    const q =
      typeof raw === "string" || typeof raw === "number" ? String(raw).trim().slice(0, 100) : "";
    return q ? { q } : {};
  },
  head: () =>
    pageHead({
      title: "คลังความรู้ · SWING Academy",
      description: "งานวิจัยและบทเรียนจาก SWING และภาคี ค้นหาได้ อ่านฟรี ทั้งไทยและอังกฤษ",
      path: "/knowledge",
    }),
  component: KnowledgeIndexPage,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

/** Every word in the query must appear somewhere in the item (titles, summary, tags). */
function matches(item: KnowledgeRow, query: string) {
  const haystack = [
    item.titleTh,
    item.titleEn,
    item.summary,
    item.keyMessage,
    item.productService,
    ...item.tags,
    ...item.categories,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function KnowledgeIndexPage() {
  const { t, lang } = useLanguage();
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const fetchAll = useServerFn(listPublicKnowledge);
  const { data } = useSuspenseQuery({
    queryKey: ["knowledge", "public", "all"],
    queryFn: () => fetchAll(),
    staleTime: 60_000,
  });
  const items = q ? data.items.filter((k) => matches(k, q)) : data.items;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const query = draft.trim();
    navigate({ search: query ? { q: query } : {}, replace: true });
  };

  const resultText = q
    ? t({
        th: `พบ ${items.length} เรื่อง จากคำว่า “${q}”`,
        en: `${items.length} result${items.length === 1 ? "" : "s"} for “${q}”`,
      })
    : "";

  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-16">
        <p
          lang={lang}
          className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-accuracy-ink"
        >
          {t({
            th: "งานวิจัย · บทเรียน · ความรู้จากชุมชน",
            en: "Research · lessons · community knowledge",
          })}
        </p>
        <h1 lang={lang} className="text-4xl font-semibold text-navy-500 md:text-5xl">
          {t({ th: "คลังความรู้", en: "Knowledge library" })}
        </h1>
        <p lang={lang} className="mt-3 max-w-2xl text-lg text-warm-600">
          {t({
            th: "งานวิจัยและบทเรียนที่ SWING กับภาคีเปิดให้ทุกคนอ่าน เอาไปใช้เรียนหรือปรับบริการในชุมชนของคุณได้เลย",
            en: "Research and lessons from SWING and partners, free to read and to use in your own community work.",
          })}
        </p>

        <form
          role="search"
          action="/knowledge"
          method="get"
          onSubmit={submit}
          className="mt-8 flex max-w-2xl items-center gap-2 rounded-pill border border-warm-300 bg-white p-1.5 pl-5 shadow-sm transition-shadow focus-within:border-accuracy focus-within:shadow-md"
        >
          <Search className="h-5 w-5 shrink-0 text-warm-400" aria-hidden />
          <label htmlFor="knowledge-search" className="sr-only">
            {t({ th: "ค้นหาในคลังความรู้", en: "Search the knowledge library" })}
          </label>
          <input
            id="knowledge-search"
            name="q"
            type="search"
            maxLength={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t({ th: "ค้นบทเรียน เช่น PrEP", en: "Search, e.g. PrEP" })}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-navy-500 placeholder:text-warm-500 focus:outline-hidden"
          />
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center rounded-pill bg-navy-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
          >
            {t({ th: "ค้นหา", en: "Search" })}
          </button>
        </form>

        {/* Always mounted, so screen readers announce the count on the first search too */}
        <p role="status" className="sr-only">
          {resultText}
        </p>

        {q && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-warm-600">
            <span lang={lang} aria-hidden>
              {resultText}
            </span>
            <Link
              to="/knowledge"
              className="inline-flex min-h-11 items-center gap-1 rounded-pill border border-warm-300 bg-white px-4 text-sm font-medium text-navy-500 hover:border-navy-500"
            >
              <X className="h-4 w-4" aria-hidden />
              {t({ th: "ล้างคำค้น", en: "Clear search" })}
            </Link>
          </div>
        )}

        {items.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-warm-300 bg-white px-6 py-12 text-center text-warm-600">
            <p lang={lang}>
              {q
                ? t({
                    th: "ยังไม่เจอเรื่องที่ตรงกับคำนี้ ใช้คำที่สั้นลง หรือกดดูทั้งหมดด้านล่าง",
                    en: "Nothing matches yet. Use a shorter word, or see everything below.",
                  })
                : t({ th: "ยังไม่มีเรื่องที่เผยแพร่ในคลัง", en: "Nothing published yet." })}
            </p>
            {q && (
              <Link
                to="/knowledge"
                className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accuracy-ink"
              >
                {t({ th: "ดูทั้งหมด", en: "See everything" })}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((k) => (
              <Link
                key={k.id}
                to="/knowledge/$slug"
                params={{ slug: k.slug }}
                aria-labelledby={`k-${k.id}-title`}
                className="group flex flex-col overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
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
                  <h2
                    id={`k-${k.id}-title`}
                    lang={lang === "en" && k.titleEn ? "en" : "th"}
                    className="line-clamp-3 text-lg font-semibold text-navy-500 group-hover:text-accuracy-ink"
                  >
                    {t({ th: k.titleTh, en: k.titleEn || k.titleTh })}
                  </h2>
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
        )}
      </section>
    </PublicLayout>
  );
}
