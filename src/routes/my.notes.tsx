import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, StickyNote } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { listMyNotes, deleteNote } from "@/lib/lesson-notes.functions";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/my/notes")({
  component: MyNotesPage,
});

function MyNotesPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotes);
  const delFn = useServerFn(deleteNote);
  const { data, isLoading } = useQuery({ queryKey: ["my-notes"], queryFn: () => listFn() });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notes"] }),
  });

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-magenta-500" />
          <h1 className="text-2xl font-semibold text-navy-500">
            {t({ th: "โน้ตของฉัน", en: "My notes" })}
          </h1>
        </div>
        {isLoading && <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-magenta-500" /></div>}
        <ul className="mt-6 space-y-3">
          {(data ?? []).map((n) => (
            <li key={n.id} className="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-navy-500/60">
                    {n.courses?.title ?? ""} {n.lessons?.title ? `· ${n.lessons.title}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-navy-500">{n.body}</p>
                  <p className="mt-2 text-[11px] text-navy-500/50">
                    {new Date(n.updated_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => confirm(t({ th: "ลบโน้ตนี้?", en: "Delete this note?" })) && del.mutate(n.id)}
                  className="rounded-pill border border-warm-300 p-1.5 text-warm-700 hover:bg-warm-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {!isLoading && (data ?? []).length === 0 && (
            <li className="rounded-2xl border-2 border-dashed border-warm-300 p-10 text-center text-sm text-navy-500/60">
              {t({ th: "ยังไม่มีโน้ต ลองเริ่มจดในบทเรียน", en: "No notes yet. Try taking one inside a lesson." })}
            </li>
          )}
        </ul>
      </div>
    </PublicLayout>
  );
}
