// Translation renderers — show output_md as the actual published shape
// (social card, carousel, slide deck, FAQ, etc.) so staff and the public
// can see exactly what the published artifact looks like.

import { useMemo, useState, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Heart,
  MessageCircle,
  Share2,
  ChevronDown,
  Code2,
  Eye,
} from "lucide-react";
import { MermaidBlock } from "@/components/mermaid-block";

export type RendererProps = {
  format: string;
  outputMd: string;
  title?: string | null;
  language?: string;
  heroImageUrl?: string | null;
};

/* ----------------------- markdown with mermaid + images ----------------------- */
function SmartMarkdown({ children }: { children: string }) {
  const components: ComponentProps<typeof ReactMarkdown>["components"] = {
    code({ className, children, ...props }) {
      const lang = /language-(\w+)/.exec(className || "")?.[1];
      const text = String(children ?? "");
      if (lang === "mermaid") return <MermaidBlock code={text} />;
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    img({ src, alt }) {
      if (!src) return null;
      return (
        <img
          src={src as string}
          alt={alt || ""}
          loading="lazy"
          className="my-3 rounded-lg border border-warm-200"
        />
      );
    },
  };
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

function HeroImage({ url, alt }: { url?: string | null; alt?: string | null }) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt || "hero"}
      className="mb-4 w-full rounded-xl border border-warm-200 object-cover"
    />
  );
}

/* ------------------------- markdown utilities ------------------------- */

type Section = { title: string; body: string };

function splitH2(md: string): Section[] {
  const lines = md.split("\n");
  const out: Section[] = [];
  let intro: string[] = [];
  let cur: Section | null = null;
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (cur) out.push(cur);
      cur = { title: m[1].trim(), body: "" };
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    } else {
      intro.push(line);
    }
  }
  if (cur) out.push(cur);
  const introBody = intro.join("\n").trim();
  if (introBody && out.length === 0) out.push({ title: "", body: introBody });
  else if (introBody) out.unshift({ title: "บทนำ", body: introBody });
  return out;
}

function extractTagsFromMd(md: string): string[] {
  const set = new Set<string>();
  const re = /(?:^|\s)(#[\p{L}0-9_]{2,30})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) set.add(m[1]);
  return Array.from(set).slice(0, 10);
}

function stripHashtags(md: string): string {
  return md.replace(/(?:^|\s)#[\p{L}0-9_]{2,30}/gu, "").trim();
}

function extractCodeBlock(md: string, lang: string): string | null {
  const re = new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)```", "i");
  const m = re.exec(md);
  return m ? m[1].trim() : null;
}

function parseFaq(md: string): Array<{ q: string; a: string }> {
  const items: Array<{ q: string; a: string }> = [];
  // Pattern: lines starting with Q: ... then A: ...
  const blocks = md.split(/\n(?=\s*(?:Q:|##\s*Q[:\-]|\*\*Q))/i);
  for (const block of blocks) {
    const qm = /(?:Q:|##\s*Q[:\-]|\*\*Q[\.:]?\*\*)\s*(.+?)(?=\n|$)/i.exec(block);
    const am = /(?:A:|\*\*A[\.:]?\*\*)\s*([\s\S]+)$/i.exec(block);
    if (qm && am) items.push({ q: qm[1].trim(), a: am[1].trim() });
  }
  if (items.length > 0) return items;
  // Fallback: ### headings = Q, body = A
  const re = /###\s+(.+?)\n([\s\S]*?)(?=\n###\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) items.push({ q: m[1].trim(), a: m[2].trim() });
  return items;
}

/* --------------------------- individual renderers --------------------------- */

function SocialCard({ outputMd, heroImageUrl }: RendererProps) {
  const tags = useMemo(() => extractTagsFromMd(outputMd), [outputMd]);
  const body = useMemo(() => stripHashtags(outputMd), [outputMd]);
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-warm-100 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-magenta-500 to-lavender-500 text-sm font-bold text-white">
          S
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-navy-500">SWING Academy</p>
          <p className="text-[11px] text-warm-500">@swingacademy · just now</p>
        </div>
      </div>
      <div className="prose prose-sm max-w-none px-4 py-3 text-navy-500">
        <SmartMarkdown>{body}</SmartMarkdown>
      </div>
      {heroImageUrl && (
        <img src={heroImageUrl} alt="" className="w-full object-cover" />
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-3 pt-3 text-xs text-magenta-600">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-5 border-t border-warm-100 px-4 py-2 text-warm-500">
        <span className="inline-flex items-center gap-1 text-xs">
          <Heart className="h-3.5 w-3.5" /> 128
        </span>
        <span className="inline-flex items-center gap-1 text-xs">
          <MessageCircle className="h-3.5 w-3.5" /> 24
        </span>
        <span className="inline-flex items-center gap-1 text-xs">
          <Share2 className="h-3.5 w-3.5" /> 9
        </span>
      </div>
    </div>
  );
}

function CarouselDeck({ outputMd }: RendererProps) {
  const slides = useMemo(() => {
    const s = splitH2(outputMd);
    return s.length > 0 ? s : [{ title: "", body: outputMd }];
  }, [outputMd]);
  return (
    <Carousel className="mx-auto w-full max-w-md">
      <CarouselContent>
        {slides.map((s, i) => (
          <CarouselItem key={i}>
            <div className="flex aspect-square flex-col justify-between rounded-2xl bg-gradient-to-br from-magenta-500 via-magenta-600 to-lavender-600 p-6 text-white shadow-lg">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                {i + 1} / {slides.length}
              </div>
              <div>
                {s.title && <h3 className="text-2xl font-bold leading-tight">{s.title}</h3>}
                <div className="prose prose-invert prose-sm mt-3 max-w-none text-white/95">
                  <SmartMarkdown>{s.body}</SmartMarkdown>
                </div>
              </div>
              <div className="text-[11px] text-white/70">SWING Academy</div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

function SlideDeck({ outputMd }: RendererProps) {
  const slides = useMemo(() => splitH2(outputMd), [outputMd]);
  const [i, setI] = useState(0);
  if (slides.length === 0) return <Article outputMd={outputMd} format="" />;
  const cur = slides[Math.min(i, slides.length - 1)];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="aspect-video overflow-hidden rounded-xl border border-warm-200 bg-white p-8 shadow-md">
        <div className="flex h-full flex-col">
          <div className="text-xs font-semibold uppercase tracking-wider text-magenta-600">
            Slide {i + 1} / {slides.length}
          </div>
          <h3 className="mt-2 text-2xl font-bold text-navy-500 md:text-3xl">{cur.title}</h3>
          <div className="prose prose-slate mt-4 max-w-none flex-1 overflow-auto text-base">
            <SmartMarkdown>{cur.body}</SmartMarkdown>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => setI(Math.max(0, i - 1))}
          disabled={i === 0}
          className="rounded-md border border-warm-200 bg-white px-3 py-1.5 hover:bg-warm-50 disabled:opacity-40"
        >
          ก่อนหน้า
        </button>
        <div className="flex gap-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-2 w-2 rounded-full ${idx === i ? "bg-magenta-500" : "bg-warm-200"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setI(Math.min(slides.length - 1, i + 1))}
          disabled={i >= slides.length - 1}
          className="rounded-md border border-warm-200 bg-white px-3 py-1.5 hover:bg-warm-50 disabled:opacity-40"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}

function FaqAccordion({ outputMd }: RendererProps) {
  const items = useMemo(() => parseFaq(outputMd), [outputMd]);
  const [open, setOpen] = useState<number | null>(0);
  if (items.length === 0) return <Article outputMd={outputMd} format="" />;
  return (
    <div className="mx-auto w-full max-w-2xl divide-y divide-warm-200 rounded-xl border border-warm-200 bg-white">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-navy-500 hover:bg-warm-50"
            >
              <span>{it.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="prose prose-sm max-w-none px-5 pb-4 text-warm-700">
                <SmartMarkdown>{it.a}</SmartMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Infographic({ outputMd, title }: RendererProps) {
  const sections = useMemo(() => splitH2(outputMd), [outputMd]);
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-magenta-500 via-magenta-600 to-lavender-700 p-6 text-white shadow-lg">
      {title && <h3 className="mb-4 text-center text-xl font-bold">{title}</h3>}
      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={i} className="rounded-xl bg-white/15 p-4 backdrop-blur">
            {s.title && (
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-magenta-600">
                  {i + 1}
                </span>
                <h4 className="font-semibold">{s.title}</h4>
              </div>
            )}
            <div className="prose prose-invert prose-sm max-w-none text-white/95">
              <SmartMarkdown>{s.body}</SmartMarkdown>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-[10px] text-white/70">swingacademy.life</div>
    </div>
  );
}

function LearningCard({ outputMd, title }: RendererProps) {
  const sections = useMemo(() => splitH2(outputMd), [outputMd]);
  const front = sections[0] ?? { title: title ?? "บทเรียน", body: outputMd };
  const back = sections[1];
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="mx-auto w-full max-w-md">
      <button
        onClick={() => setFlipped((f) => !f)}
        className="block aspect-[4/3] w-full overflow-hidden rounded-2xl border-2 border-magenta-200 bg-gradient-to-br from-cream to-lavender-50 p-6 text-left shadow-md hover:shadow-lg"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-magenta-600">
          {flipped ? "คำตอบ · Back" : "คำถาม · Front"}
        </div>
        <div className="prose prose-slate mt-3 max-w-none">
          {!flipped ? (
            <>
              {front.title && <h3 className="text-navy-500">{front.title}</h3>}
              <SmartMarkdown>{front.body}</SmartMarkdown>
            </>
          ) : back ? (
            <>
              {back.title && <h3 className="text-navy-500">{back.title}</h3>}
              <SmartMarkdown>{back.body}</SmartMarkdown>
            </>
          ) : (
            <p className="italic text-warm-500">เพิ่ม section ที่สอง (## ...) เพื่อใส่คำตอบ</p>
          )}
        </div>
        <div className="mt-4 text-right text-[11px] text-warm-500">แตะเพื่อพลิกการ์ด</div>
      </button>
    </div>
  );
}

function HtmlPage({ outputMd }: RendererProps) {
  const html = useMemo(() => extractCodeBlock(outputMd, "html"), [outputMd]);
  if (!html) return <Article outputMd={outputMd} format="" />;
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-warm-200 bg-white shadow-sm">
      <div className="border-b border-warm-200 bg-warm-50 px-4 py-2 text-xs text-warm-500">
        HTML Preview
      </div>
      <iframe
        srcDoc={html}
        sandbox="allow-same-origin"
        className="h-[480px] w-full"
        title="HTML preview"
      />
    </div>
  );
}

function FlowChart({ outputMd }: RendererProps) {
  // Simple ordered steps from numbered list / H2 sections
  const steps = useMemo(() => {
    const sec = splitH2(outputMd);
    if (sec.length > 1) return sec.map((s) => s.title || s.body.split("\n")[0].slice(0, 80));
    const items: string[] = [];
    const re = /^\s*(?:\d+[\.\)]|-)\s+(.+)$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(outputMd))) items.push(m[1].trim());
    return items;
  }, [outputMd]);
  if (steps.length === 0) return <Article outputMd={outputMd} format="" />;
  return (
    <div className="mx-auto w-full max-w-md space-y-2">
      {steps.map((s, i) => (
        <div key={i}>
          <div className="flex items-start gap-3 rounded-xl border border-warm-200 bg-white p-4 shadow-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-magenta-500 text-sm font-bold text-white">
              {i + 1}
            </span>
            <p className="pt-1 text-sm text-navy-500">{s}</p>
          </div>
          {i < steps.length - 1 && (
            <div className="mx-auto my-1 h-4 w-0.5 bg-magenta-300" />
          )}
        </div>
      ))}
    </div>
  );
}

function ChatScript({ outputMd }: RendererProps) {
  // Parse "Bot:" / "User:" / "AI:" / "Q:" / "A:" prefixes
  const turns = useMemo(() => {
    const lines = outputMd.split("\n").filter((l) => l.trim());
    return lines
      .map((l) => {
        const m = /^\s*([A-Za-z]+|บอท|ผู้ใช้)\s*:\s*(.+)$/.exec(l);
        if (!m) return null;
        const role = m[1].toLowerCase();
        const isBot = ["bot", "ai", "บอท", "swing", "assistant", "a"].includes(role);
        return { isBot, text: m[2].trim(), label: m[1] };
      })
      .filter(Boolean) as Array<{ isBot: boolean; text: string; label: string }>;
  }, [outputMd]);
  if (turns.length === 0) return <Article outputMd={outputMd} format="" />;
  return (
    <div className="mx-auto w-full max-w-md space-y-2 rounded-2xl border border-warm-200 bg-cream/40 p-4">
      {turns.map((t, i) => (
        <div key={i} className={`flex ${t.isBot ? "justify-start" : "justify-end"}`}>
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
              t.isBot
                ? "rounded-bl-sm bg-white text-navy-500"
                : "rounded-br-sm bg-magenta-500 text-white"
            }`}
          >
            {t.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoScript({ outputMd }: RendererProps) {
  const scenes = useMemo(() => splitH2(outputMd), [outputMd]);
  if (scenes.length === 0) return <Article outputMd={outputMd} format="" />;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {scenes.map((s, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-warm-200 bg-white shadow-sm">
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-navy-500 to-magenta-600 text-white">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-white/70">Scene {i + 1}</div>
              <div className="mt-1 px-4 text-lg font-semibold">{s.title}</div>
            </div>
          </div>
          <div className="prose prose-sm max-w-none p-4 text-navy-500">
            <SmartMarkdown>{s.body}</SmartMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

function Poster({ outputMd, title }: RendererProps) {
  return (
    <div className="mx-auto w-full max-w-sm aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-br from-navy-600 via-magenta-700 to-lavender-700 p-8 text-white shadow-xl">
      <div className="flex h-full flex-col justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/80">
          SWING · Campaign
        </div>
        <div>
          {title && <h3 className="text-3xl font-extrabold leading-tight">{title}</h3>}
          <div className="prose prose-invert prose-sm mt-4 max-w-none text-white/95">
            <SmartMarkdown>{outputMd}</SmartMarkdown>
          </div>
        </div>
        <div className="text-[10px] text-white/70">swingacademy.life</div>
      </div>
    </div>
  );
}

function Article({ outputMd, title }: RendererProps) {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-warm-200 bg-white p-6 md:p-8">
      {title && <h3 className="mb-4 text-2xl font-bold text-navy-500">{title}</h3>}
      <div className="prose prose-slate max-w-none prose-headings:text-navy-500 prose-a:text-magenta-600">
        <SmartMarkdown>{outputMd}</SmartMarkdown>
      </div>
    </div>
  );
}

/* ----------------------------- dispatcher ----------------------------- */

export function TranslationRenderer(props: RendererProps) {
  const { format, outputMd } = props;
  if (!outputMd.trim()) {
    return (
      <div className="rounded-lg border border-dashed border-warm-200 bg-warm-50/60 p-8 text-center text-sm text-warm-500">
        ยังไม่มีเนื้อหา — กด Generate หรือพิมพ์ใน Edit tab
      </div>
    );
  }
  switch (format) {
    case "social_caption":
    case "campaign_message":
      return <SocialCard {...props} />;
    case "carousel":
      return <CarouselDeck {...props} />;
    case "slide_outline":
      return <SlideDeck {...props} />;
    case "faq":
      return <FaqAccordion {...props} />;
    case "infographic_text":
      return <Infographic {...props} />;
    case "poster_concept":
      return <Poster {...props} />;
    case "learning_card":
      return <LearningCard {...props} />;
    case "html_page":
      return <HtmlPage {...props} />;
    case "flow_chart":
      return <FlowChart {...props} />;
    case "chatbot_script":
    case "script":
      return <ChatScript {...props} />;
    case "short_video_script":
      return <VideoScript {...props} />;
    case "short_article":
    case "training_handout":
    case "micro_learning":
    default:
      return <Article {...props} />;
  }
}

/* small thumbnail for list cards (compact preview) */
export function TranslationThumbnail({ format, outputMd }: { format: string; outputMd: string }) {
  if (!outputMd) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md bg-warm-50 text-xs text-warm-500">
        empty
      </div>
    );
  }
  switch (format) {
    case "social_caption":
    case "campaign_message":
      return (
        <div className="rounded-md border border-warm-200 bg-white p-2 text-[11px] text-navy-500 line-clamp-3">
          {stripHashtags(outputMd).slice(0, 140)}
        </div>
      );
    case "carousel":
    case "infographic_text":
    case "poster_concept":
      return (
        <div className="flex h-24 items-center justify-center rounded-md bg-gradient-to-br from-magenta-500 to-lavender-600 px-3 text-center text-[11px] font-semibold text-white">
          {(splitH2(outputMd)[0]?.title ?? outputMd).slice(0, 60)}
        </div>
      );
    case "slide_outline":
      return (
        <div className="aspect-video rounded-md border border-warm-200 bg-white p-2 text-[10px] text-navy-500">
          <div className="font-semibold">{splitH2(outputMd)[0]?.title ?? "Slide"}</div>
        </div>
      );
    case "html_page":
      return (
        <div className="flex h-24 items-center justify-center rounded-md bg-warm-100 text-[11px] text-warm-600">
          <Code2 className="mr-1 h-3 w-3" /> HTML preview
        </div>
      );
    default:
      return (
        <div className="line-clamp-4 rounded-md bg-warm-50 p-2 text-[11px] text-warm-700">
          {outputMd.replace(/[#*_>`-]/g, " ").slice(0, 200)}
        </div>
      );
  }
}

export function MarkdownToggle({
  outputMd,
  children,
}: {
  outputMd: string;
  children: React.ReactNode;
}) {
  const [showSource, setShowSource] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          onClick={() => setShowSource((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-warm-200 bg-white px-2 py-1 text-[11px] text-warm-600 hover:bg-warm-50"
        >
          {showSource ? <Eye className="h-3 w-3" /> : <Code2 className="h-3 w-3" />}
          {showSource ? "ดู Visual" : "ดู Markdown"}
        </button>
      </div>
      {showSource ? (
        <pre className="max-h-96 overflow-auto rounded-md border border-warm-200 bg-warm-50 p-3 text-[11px] text-warm-700">
          {outputMd}
        </pre>
      ) : (
        children
      )}
    </div>
  );
}
