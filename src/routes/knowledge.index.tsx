import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Globe } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { listPublicKnowledge } from "@/lib/knowledge.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/knowledge/")({
  head: () =>
    pageHead({
      title: "Knowledge Products — SWING Academy",
      description: "งานวิจัย บทเรียน และความรู้สาธารณะจาก SWING Academy",
      path: "/knowledge",
    }),
  component: KnowledgeIndexPage,
  errorComponent: ({ error }) => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-warm-500">โหลดรายการไม่สำเร็จ: {error.message}</p>
      </div>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-warm-500">ไม่พบเนื้อหา</div>
    </PublicLayout>
  ),
});

function KnowledgeIndexPage() {
  const fetchAll = useServerFn(listPublicKnowledge);
  const { data } = useSuspenseQuery({
    queryKey: ["knowledge", "public", "all"],
    queryFn: () => fetchAll(),
    staleTime: 60_000,
  });
  const items = data.items;

  return (
    <PublicLayout>
      <section className="mx-auto max-w-6xl px-6 pt-12 pb-16">
        <p className="eyebrow mb-3">งานวิจัย · บทเรียน · ความรู้จากชุมชน</p>
        <h1 className="text-4xl font-semibold text-navy-500 md:text-5xl">Knowledge Products</h1>
        <p className="mt-3 max-w-2xl text-lg text-warm-500">
          เนื้อหาสาธารณะที่ SWING และพันธมิตรเผยแพร่ — เปิดให้ใช้เพื่อการศึกษาและพัฒนาบริการของชุมชน
        </p>

        {items.length === 0 ? (
          <div className="mt-12 rounded-lg border border-dashed border-warm-200 bg-white px-6 py-12 text-center text-warm-500">
            ยังไม่มี Knowledge Product ที่เผยแพร่
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
    </PublicLayout>
  );
}
