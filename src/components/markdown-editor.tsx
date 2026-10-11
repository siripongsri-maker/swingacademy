import { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Sparkles,
  Loader2,
  Highlighter,
} from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/lib/auth-headers";

type Props = {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
};

/**
 * Lightweight markdown editor with a blog-style toolbar.
 * Operates on a plain textarea so output stays as markdown
 * and remains compatible with TranslationRenderer.
 */
export function MarkdownEditor({ value, onChange, rows = 14, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [imgBusy, setImgBusy] = useState(false);

  function apply(transform: (sel: string) => { text: string; cursorOffset?: number }) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    const { text, cursorOffset } = transform(sel);
    const next = before + text + after;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = cursorOffset !== undefined ? start + cursorOffset : start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const wrap = (token: string, placeholderText = "ข้อความ") =>
    apply((s) => {
      const inner = s || placeholderText;
      return { text: `${token}${inner}${token}`, cursorOffset: token.length + inner.length };
    });

  const linePrefix = (prefix: string, placeholderText = "") =>
    apply((s) => {
      const inner = s || placeholderText;
      const lines = inner.split("\n").map((l) => (l.startsWith(prefix) ? l : `${prefix}${l}`));
      return { text: lines.join("\n") };
    });

  const numberedList = () =>
    apply((s) => {
      const inner = s || "รายการ";
      const lines = inner.split("\n").map((l, i) => `${i + 1}. ${l}`);
      return { text: lines.join("\n") };
    });

  const block = (open: string, close: string, placeholderText = "") =>
    apply((s) => {
      const inner = s || placeholderText;
      return { text: `\n${open}\n${inner}\n${close}\n` };
    });

  const insertLink = () => {
    const url = window.prompt("URL");
    if (!url) return;
    apply((s) => {
      const label = s || "ข้อความลิงก์";
      return { text: `[${label}](${url})` };
    });
  };

  const insertImageUrl = () => {
    const url = window.prompt("ลิงก์รูปภาพ (URL)");
    if (!url) return;
    const alt = window.prompt("คำอธิบายภาพ (alt)", "") || "image";
    apply(() => ({ text: `\n\n![${alt}](${url})\n\n` }));
  };

  async function insertAiImage() {
    const promptText = window.prompt(
      "Prompt สำหรับภาพ (ภาษาอังกฤษได้ผลดีกว่า)",
      "Editorial illustration, warm inclusive style, no text"
    );
    if (!promptText) return;
    setImgBusy(true);
    try {
      const res = await fetch("/api/generate-translation-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ prompt: promptText }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = (await res.json()) as { dataUrl?: string; error?: string };
      if (!data.dataUrl) throw new Error(data.error || "no image");
      apply(() => ({ text: `\n\n![AI image](${data.dataUrl})\n\n` }));
      toast.success("เพิ่มภาพแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้างภาพไม่สำเร็จ");
    } finally {
      setImgBusy(false);
    }
  }

  const Btn = ({
    onClick,
    title,
    children,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 hover:bg-warm-100 hover:text-magenta-700"
    >
      {children}
    </button>
  );

  const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-warm-50/60 px-2 py-1">
        <Btn onClick={() => wrap("**", "ตัวหนา")} title="Bold (Ctrl+B)"><Bold className="h-4 w-4" /></Btn>
        <Btn onClick={() => wrap("*", "ตัวเอียง")} title="Italic"><Italic className="h-4 w-4" /></Btn>
        <Btn onClick={() => wrap("~~", "ขีดทับ")} title="Strikethrough"><Strikethrough className="h-4 w-4" /></Btn>
        <Btn onClick={() => wrap("==", "ไฮไลต์")} title="Highlight"><Highlighter className="h-4 w-4" /></Btn>
        <Sep />
        <Btn onClick={() => linePrefix("# ", "หัวข้อใหญ่")} title="H1"><Heading1 className="h-4 w-4" /></Btn>
        <Btn onClick={() => linePrefix("## ", "หัวข้อรอง")} title="H2"><Heading2 className="h-4 w-4" /></Btn>
        <Btn onClick={() => linePrefix("### ", "หัวข้อย่อย")} title="H3"><Heading3 className="h-4 w-4" /></Btn>
        <Sep />
        <Btn onClick={() => linePrefix("- ", "รายการ")} title="Bullet list"><List className="h-4 w-4" /></Btn>
        <Btn onClick={numberedList} title="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
        <Btn onClick={() => linePrefix("> ", "คำพูด/อ้างอิง")} title="Quote"><Quote className="h-4 w-4" /></Btn>
        <Btn onClick={() => block("```", "```", "// code")} title="Code block"><Code className="h-4 w-4" /></Btn>
        <Sep />
        <Btn onClick={insertLink} title="Insert link"><LinkIcon className="h-4 w-4" /></Btn>
        <Btn onClick={insertImageUrl} title="Insert image (URL)"><ImageIcon className="h-4 w-4" /></Btn>
        <button
          type="button"
          onClick={insertAiImage}
          disabled={imgBusy}
          title="Generate image with AI"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-magenta-700 hover:bg-magenta-50 disabled:opacity-50"
        >
          {imgBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI Image
        </button>
        <Sep />
        <Btn onClick={() => apply(() => ({ text: `\n\n---\n\n` }))} title="Horizontal rule">
          <Minus className="h-4 w-4" />
        </Btn>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            wrap("**", "ตัวหนา");
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
            e.preventDefault();
            wrap("*", "ตัวเอียง");
          }
        }}
        className="w-full resize-y border-0 bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-0"
      />
    </div>
  );
}
