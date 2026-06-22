import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { StickyNote, Save, Loader2, Check } from "lucide-react";
import { upsertNote, type LessonNote } from "@/lib/lesson-notes.functions";
import { useLanguage } from "@/lib/language-context";

type Props = {
  lessonId: string;
  courseId: string;
  existing?: LessonNote | null;
  onSaved?: (n: LessonNote) => void;
};

export function NoteEditor({ lessonId, courseId, existing, onSaved }: Props) {
  const { t } = useLanguage();
  const [body, setBody] = useState(existing?.body ?? "");
  const [id, setId] = useState<string | undefined>(existing?.id);
  const [visibility, setVisibility] = useState<"private" | "class">(existing?.visibility ?? "private");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const save = useServerFn(upsertNote);

  // Debounced autosave
  useEffect(() => {
    if (!body.trim()) return;
    const handle = window.setTimeout(async () => {
      setSaving(true);
      try {
        const row = await save({
          data: { id, lesson_id: lessonId, course_id: courseId, body, visibility },
        });
        setId(row.id);
        setSavedAt(Date.now());
        onSaved?.(row);
      } finally {
        setSaving(false);
      }
    }, 1200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, visibility]);

  return (
    <div className="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-magenta-500" />
          <h3 className="text-sm font-semibold text-navy-500">
            {t({ th: "โน้ตของฉัน", en: "My note" })}
          </h3>
        </div>
        <span className="text-[11px] text-navy-500/60">
          {saving ? (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {t({ th: "กำลังบันทึก…", en: "Saving…" })}</span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1 text-green-700"><Check className="h-3 w-3" /> {t({ th: "บันทึกแล้ว", en: "Saved" })}</span>
          ) : null}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t({ th: "จดสิ่งที่อยากจำจากบทเรียนนี้…", en: "Jot what you want to remember from this lesson…" })}
        className="mt-3 h-40 w-full resize-y rounded-md border border-warm-300 bg-white px-3 py-2 text-sm focus:border-magenta-500 focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between text-xs">
        <label className="inline-flex items-center gap-2 text-navy-500/70">
          <input
            type="checkbox"
            checked={visibility === "class"}
            onChange={(e) => setVisibility(e.target.checked ? "class" : "private")}
          />
          {t({ th: "แชร์ให้คนในห้องเรียน", en: "Share with classmates" })}
        </label>
      </div>
    </div>
  );
}
