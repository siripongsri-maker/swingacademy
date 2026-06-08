import { createFileRoute, Link } from "@tanstack/react-router";
import { useProductKnowledge } from "@/lib/product-knowledge-store";
import { FileText, Image as ImageIcon, Video, Music, Presentation, ExternalLink, Lock } from "lucide-react";

export const Route = createFileRoute("/k/$slug")({
  component: PublicKnowledgePage,
});

const ICONS = {
  pdf: FileText,
  slides: Presentation,
  image: ImageIcon,
  video_url: Video,
  audio: Music,
} as const;

function PublicKnowledgePage() {
  const { slug } = Route.useParams();
  const pk = useProductKnowledge();
  const asset = pk.getAssetBySlug(slug);

  if (!asset) {
    return (
      <Frame>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ไม่พบความรู้ที่อ้างอิงด้วยลิงก์นี้ หรืออาจถูกลบไปแล้ว
          </p>
          <Link to="/" className="mt-6 inline-block text-sm font-medium text-magenta-600 hover:underline">
            ← Back to SWING Academy
          </Link>
        </div>
      </Frame>
    );
  }

  if (asset.visibility !== "public" || asset.status !== "published") {
    return (
      <Frame>
        <div className="text-center">
          <Lock className="mx-auto h-10 w-10 text-warm-500" />
          <h1 className="mt-3 text-xl font-bold text-foreground">This knowledge is not public</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ลิงก์นี้ถูกตั้งค่าให้เข้าถึงได้เฉพาะภายในทีมหรือยังไม่ได้เผยแพร่
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <article className="space-y-6">
        <header>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-magenta-50 px-2 py-0.5 font-semibold text-magenta-700">
              {pk.typeLabels[asset.type]?.en ?? asset.type}
            </span>
            {asset.categories.map((c) => (
              <span key={c} className="rounded-full bg-warm-100 px-2 py-0.5 text-warm-700">
                {pk.categoryLabels[c]?.en ?? c}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
            {asset.titleEn || asset.titleTh}
          </h1>
          {asset.titleTh && asset.titleEn && (
            <p lang="th" className="mt-1 text-lg text-muted-foreground">{asset.titleTh}</p>
          )}
          {asset.summary && <p className="mt-3 text-base text-foreground/80">{asset.summary}</p>}
        </header>

        {asset.keyMessage && (
          <div className="rounded-lg border-l-4 border-magenta-500 bg-magenta-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-magenta-700">Key message</p>
            <p className="mt-1 text-foreground">{asset.keyMessage}</p>
          </div>
        )}

        {asset.contentMd && (
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-card p-4 font-sans text-sm leading-relaxed text-foreground">
            {asset.contentMd}
          </pre>
        )}

        {asset.attachments.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attachments</h2>
            <ul className="mt-2 space-y-2">
              {asset.attachments.map((att) => {
                const Icon = ICONS[att.kind] ?? FileText;
                return (
                  <li key={att.id}>
                    <a
                      href={att.externalUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-warm-50"
                    >
                      <Icon className="h-4 w-4 text-magenta-500" />
                      <span className="flex-1 truncate text-foreground">{att.title ?? att.externalUrl}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(asset.source || asset.sourceUrl) && (
          <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
            <p className="font-semibold uppercase tracking-wide">Source</p>
            {asset.source && <p className="mt-1">{asset.source}</p>}
            {asset.sourceUrl && (
              <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-magenta-600 hover:underline">
                {asset.sourceUrl} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </footer>
        )}
      </article>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-3">
          <Link to="/" className="text-sm font-semibold text-foreground hover:text-magenta-600">
            SWING Academy
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
