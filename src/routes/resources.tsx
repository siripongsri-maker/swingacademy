import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Video, Image as ImageIcon, Link as LinkIcon, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/resources")({
  component: ResourcesPage,
});

type ResourceType = "pdf" | "video" | "infographic" | "link";

type Resource = {
  id: string;
  type: ResourceType;
  category: string;
  meta: string | Localized;
  title: Localized;
  blurb: Localized;
};

const typeIcon: Record<ResourceType, typeof FileText> = {
  pdf: FileText,
  video: Video,
  infographic: ImageIcon,
  link: LinkIcon,
};

const typeAccent: Record<ResourceType, string> = {
  pdf: "#CC0099",
  video: "#7A6FC4",
  infographic: "#C9A227",
  link: "#1F8A5B",
};

const typeLabel: Record<ResourceType, Localized> = {
  pdf: { th: "PDF", en: "PDF" },
  video: { th: "วิดีโอ", en: "Video" },
  infographic: { th: "อินโฟกราฟิก", en: "Infographic" },
  link: { th: "ลิงก์", en: "Link" },
};

type Filter = "all" | ResourceType | "saved";

function ResourcesPage() {
  const { t, lang } = useLanguage();
  const { saved, toggleSaved } = useAccount();
  const [filter, setFilter] = useState<Filter>("all");

  const resources = seed.publicPortal.resources as Resource[];

  const filtered = useMemo(() => {
    if (filter === "all") return resources;
    if (filter === "saved") return resources.filter((r) => saved.includes(r.id));
    return resources.filter((r) => r.type === filter);
  }, [filter, resources, saved]);

  const chips: { id: Filter; label: Localized }[] = [
    { id: "all", label: { th: "ทั้งหมด", en: "All" } },
    { id: "pdf", label: typeLabel.pdf },
    { id: "video", label: typeLabel.video },
    { id: "infographic", label: typeLabel.infographic },
    { id: "link", label: typeLabel.link },
    { id: "saved", label: { th: "บันทึกไว้", en: "Saved" } },
  ];

  return (
    <PublicLayout>
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="eyebrow mb-3">{t({ th: "คลังทรัพยากร", en: "Resource library" })}</p>
          <h1 lang={lang} className="max-w-2xl text-4xl font-semibold leading-tight text-navy-500">
            {t({
              th: "ดาวน์โหลด แชร์ และเก็บไว้ใช้ได้",
              en: "Download, share, and keep for whenever you need it",
            })}
          </h1>
          <p lang={lang} className="mt-3 max-w-2xl text-lg text-warm-500">
            {t({
              th: "คู่มือ อินโฟกราฟิก วิดีโอสั้น และลิงก์ที่เลือกมาให้แล้ว ใช้งานได้ฟรีเสมอ",
              en: "Guides, infographics, short videos and trusted links — always free to use.",
            })}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const isActive = filter === c.id;
            const count = c.id === "saved" ? saved.length : null;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? "border-magenta-500 bg-magenta-500 text-white"
                    : "border-warm-200 bg-white text-navy-500 hover:border-magenta-500"
                }`}
              >
                <span lang={lang}>{t(c.label)}</span>
                {count !== null && (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-xs font-semibold ${
                      isActive ? "bg-white/20" : "bg-magenta-100 text-magenta-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
            <Bookmark className="mx-auto mb-3 h-8 w-8 text-warm-500" />
            <p lang={lang} className="text-base font-medium text-navy-500">
              {t({
                th: "ยังไม่มีรายการที่ตรงกับตัวกรองนี้",
                en: "No resources match this filter yet",
              })}
            </p>
            <p lang={lang} className="mt-1 text-sm text-warm-500">
              {t({
                th: "ลองเลือกตัวกรองอื่น หรือบันทึกทรัพยากรที่ชอบไว้ดูทีหลัง",
                en: "Try a different filter, or bookmark a resource for later.",
              })}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                saved={saved.includes(r.id)}
                onToggle={() => toggleSaved(r.id)}
              />
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function ResourceCard({
  resource,
  saved,
  onToggle,
}: {
  resource: Resource;
  saved: boolean;
  onToggle: () => void;
}) {
  const { t, lang } = useLanguage();
  const Icon = typeIcon[resource.type];
  const accent = typeAccent[resource.type];
  const metaText = typeof resource.meta === "string" ? resource.meta : t(resource.meta);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-md border border-warm-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between">
          <div
            className="inline-flex h-10 w-10 items-center justify-center rounded-md"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <button
            onClick={onToggle}
            aria-label={saved ? "Remove bookmark" : "Save"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-pill transition-all ${
              saved
                ? "bg-magenta-500 text-white"
                : "bg-warm-100 text-warm-500 hover:bg-magenta-100 hover:text-magenta-500"
            }`}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>

        <span
          className="mb-2 inline-flex w-fit items-center rounded-pill px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          {t(typeLabel[resource.type])}
        </span>

        <h3 lang={lang} className="text-base font-semibold leading-snug text-navy-500">
          {t(resource.title)}
        </h3>
        <p lang={lang} className="mt-1.5 text-sm text-warm-500">
          {t(resource.blurb)}
        </p>

        <div className="mt-4 flex-1" />

        <div className="mt-4 flex items-center justify-between border-t border-warm-200 pt-3 text-xs text-warm-500">
          <span>{metaText}</span>
          <button className="inline-flex items-center gap-1 font-medium text-magenta-500 hover:text-magenta-700">
            <span lang={lang}>{t({ th: "เปิด", en: "Open" })}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
