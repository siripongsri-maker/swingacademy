import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, MapPin, Users, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage } from "@/lib/language-context";
import { listTrainings } from "@/lib/trainings.functions";
import { pageHead } from "@/lib/seo";



export const Route = createFileRoute("/trainings")({
  head: () => pageHead({
    title: "Training & Knowledge Products — SWING Academy",
    description: "Published trainings, workshops, and conferences from SWING Foundation — what we learned and what we share with the community.",
    path: "/trainings",
  }),
  component: PublicTrainingsPage,
});

type Row = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  topics: string | null;
  visit_type: string | null;
  sites: string | null;
  location: string | null;
  public_title_en: string | null;
  public_title_th: string | null;
  public_summary_en: string | null;
  public_summary_th: string | null;
  outcomes: string | null;
};

const tx = {
  hero: { en: "Trainings & Knowledge Products", th: "การอบรมและผลิตภัณฑ์ความรู้" },
  sub: {
    en: "What SWING staff and partners have learned at workshops, conferences and meetings — published so the wider community can use it.",
    th: "สิ่งที่เจ้าหน้าที่และพันธมิตรของ SWING ได้เรียนรู้จากการอบรม การประชุม และการสัมมนา — เผยแพร่เพื่อให้ชุมชนนำไปใช้ประโยชน์",
  },
  empty: { en: "No published trainings yet — check back soon.", th: "ยังไม่มีการอบรมที่เผยแพร่ กลับมาดูใหม่ในภายหลัง" },
};

function PublicTrainingsPage() {
  const { lang, t } = useLanguage();
  const fn = useServerFn(listTrainings);
  const { data, isLoading } = useQuery({
    queryKey: ["public-trainings"],
    queryFn: () => fn({ data: { publishedOnly: true } }),
  });
  const rows = (data?.rows ?? []) as Row[];

  return (
    <PublicLayout>
      <section className="bg-warm-50">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-3xl font-semibold text-navy-500 sm:text-4xl">{t(tx.hero)}</h1>
          <p className="mt-3 max-w-3xl text-sm text-warm-600" style={{ lineHeight: lang === "th" ? 1.85 : 1.6 }}>
            {t(tx.sub)}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-10">
        {isLoading ? (
          <div className="flex justify-center py-12 text-warm-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center text-sm text-warm-500">{t(tx.empty)}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => <PublishedCard key={r.id} row={r} lang={lang} />)}
          </ul>
        )}
      </section>
    </PublicLayout>
  );
}

function PublishedCard({ row, lang }: { row: Row; lang: "en" | "th" }) {
  const title = (lang === "th" ? row.public_title_th : row.public_title_en) || row.public_title_en || row.public_title_th || row.topics?.split("\n")[0] || "Training";
  const summary = (lang === "th" ? row.public_summary_th : row.public_summary_en) || row.public_summary_en || row.public_summary_th || row.topics;
  return (
    <li className="flex flex-col rounded-lg border border-warm-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {row.visit_type && (
          <span className="rounded-pill bg-magenta-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-magenta-600">{row.visit_type}</span>
        )}
        <span className="inline-flex items-center gap-1 text-warm-500"><CalendarClock className="h-3 w-3" />{formatRange(row.start_date, row.end_date)}</span>
      </div>
      <h2 className="mt-2 text-lg font-semibold text-navy-500">{title}</h2>
      {summary && (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-warm-600" style={{ lineHeight: lang === "th" ? 1.8 : 1.55 }}>
          {summary}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-[11px] text-warm-500">
        {row.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{row.location}</span>}
        {row.sites && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{row.sites}</span>}
      </div>
    </li>
  );
}

function formatRange(a: string | null, b: string | null) {
  if (!a) return "—";
  const fa = new Date(a + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  if (!b || b === a) return fa;
  const fb = new Date(b + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return `${fa} → ${fb}`;
}
