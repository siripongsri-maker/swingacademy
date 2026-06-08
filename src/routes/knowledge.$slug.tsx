import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Globe, Calendar, Tag, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useProductKnowledge } from "@/lib/product-knowledge-store";
import { HIVST_KNOWLEDGE_ASSET, HIVST_SPONSORS, DEFAULT_SPONSORS, type Sponsor } from "@/data/knowledge-products-seed";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/knowledge/$slug")({
  head: ({ params }) =>
    pageHead({
      title: `${HIVST_KNOWLEDGE_ASSET.titleTh} — SWING Academy`,
      description: HIVST_KNOWLEDGE_ASSET.summary,
      path: `/knowledge/${params.slug}`,
    }),
  component: KnowledgeDetailPage,
});

function KnowledgeDetailPage() {
  const { slug } = Route.useParams();
  const { getAssetBySlug } = useProductKnowledge();
  // Fall back to the static seed so SSR/first-render works even before the
  // client-side store hydrates from localStorage.
  const asset = getAssetBySlug(slug) ?? (slug === HIVST_KNOWLEDGE_ASSET.slug ? HIVST_KNOWLEDGE_ASSET : undefined);
  if (!asset) throw notFound();

  const sponsors: Sponsor[] =
    slug === HIVST_KNOWLEDGE_ASSET.slug ? HIVST_SPONSORS : DEFAULT_SPONSORS;

  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-6 pt-10 pb-16">
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-magenta-500"
        >
          <ArrowLeft className="h-4 w-4" /> กลับสู่หน้าคอร์ส
        </Link>

        <header className="mt-6 border-b border-warm-200 pb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {asset.visibility === "public" && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-lavender-100 px-2.5 py-1 font-semibold text-lavender-900">
                <Globe className="h-3 w-3" /> Public Knowledge
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-pill bg-warm-100 px-2.5 py-1 font-semibold text-navy-500">
              <ShieldCheck className="h-3 w-3" /> {asset.status === "published" ? "เผยแพร่แล้ว" : asset.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-pill bg-warm-100 px-2.5 py-1 text-warm-600">
              <Calendar className="h-3 w-3" />
              {new Date(asset.updatedAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold text-navy-500 md:text-4xl">{asset.titleTh}</h1>
          <p className="mt-2 text-base italic text-warm-500">{asset.titleEn}</p>
          <p className="mt-4 text-lg leading-relaxed text-navy-500">{asset.summary}</p>

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
                <span key={t} className="rounded-pill bg-warm-100 px-2 py-0.5 text-navy-500">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </header>

        {asset.learningObjectives && asset.learningObjectives.length > 0 && (
          <section className="mt-8 rounded-lg border border-warm-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-500">สิ่งที่คุณจะได้เรียนรู้</h2>
            <ul className="mt-3 space-y-2 text-navy-500">
              {asset.learningObjectives.map((lo, i) => (
                <li key={i} className="flex gap-2 text-[15px]">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-magenta-500" />
                  <span>{lo}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="prose prose-slate mt-10 max-w-none prose-headings:text-navy-500 prose-h2:mt-10 prose-h2:text-2xl prose-h3:text-lg prose-a:text-magenta-600 prose-strong:text-navy-500 prose-table:text-sm prose-th:bg-warm-100 prose-th:p-2 prose-td:p-2 prose-blockquote:border-l-magenta-500 prose-blockquote:bg-cream prose-blockquote:not-italic">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{asset.contentMd}</ReactMarkdown>
        </div>

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
