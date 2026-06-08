import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, ArrowRight, Globe } from "lucide-react";
import { listFeaturedKnowledge } from "@/lib/knowledge.functions";

type Props = {
  limit?: number;
  title?: string;
  eyebrow?: string;
  emptyHint?: string | null;
};

export function FeaturedKnowledgeSection({
  limit = 3,
  title = "Knowledge Products แนะนำ",
  eyebrow = "งานวิจัย · บทเรียน · ความรู้จากชุมชน",
  emptyHint = null,
}: Props) {
  const fetchFeatured = useServerFn(listFeaturedKnowledge);
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", "featured", limit],
    queryFn: () => fetchFeatured({ data: { limit } }),
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  if (!isLoading && items.length === 0 && !emptyHint) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h2 className="text-3xl font-semibold text-navy-500 md:text-4xl">{title}</h2>
        </div>
        <Link
          to="/knowledge"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-magenta-500 hover:text-magenta-700"
        >
          ดูทั้งหมด <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg border border-warm-200 bg-warm-50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-warm-200 bg-white px-6 py-10 text-center text-sm text-warm-500">
          {emptyHint}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((k) => (
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
                {k.titleTh}
              </h3>
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
  );
}
