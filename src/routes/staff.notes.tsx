import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, StickyNote } from "lucide-react";
import { listAllNotesStaff } from "@/lib/lesson-notes.functions";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/staff/notes")({
  component: StaffNotesPage,
});

function StaffNotesPage() {
  const { t } = useLanguage();
  const listFn = useServerFn(listAllNotesStaff);
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-notes"],
    queryFn: () => listFn(),
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-2">
        <StickyNote className="h-5 w-5 text-magenta-500" />
        <h1 className="text-2xl font-semibold text-navy-500">
          {t({ th: "โน้ตทั้งหมด", en: "All notes" })}
        </h1>
      </div>
      <p className="mt-1 text-sm text-navy-500/70">
        {t({ th: "โน้ตจากผู้เรียนทุกคนในระบบ", en: "Notes captured by learners across the platform" })}
      </p>

      {isLoading && <Loader2 className="mt-6 h-5 w-5 animate-spin text-magenta-500" />}
      {error && <p className="mt-4 text-sm text-red-600">{(error as Error).message}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-warm-100 text-left text-xs uppercase tracking-wider text-navy-500/60">
            <tr>
              <th className="px-4 py-2">{t({ th: "บทเรียน/คอร์ส", en: "Lesson / Course" })}</th>
              <th className="px-4 py-2">{t({ th: "ผู้เขียน", en: "User" })}</th>
              <th className="px-4 py-2">{t({ th: "เนื้อหา", en: "Body" })}</th>
              <th className="px-4 py-2">{t({ th: "เมื่อ", en: "Updated" })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-200">
            {(data ?? []).map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-2 text-navy-500">
                  {n.lessons?.title ?? "—"}
                  <div className="text-[11px] text-navy-500/60">{n.courses?.title ?? ""}</div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{n.user_id.slice(0, 8)}…</td>
                <td className="px-4 py-2 max-w-md">
                  <div className="line-clamp-3 whitespace-pre-wrap text-navy-500/80">{n.body}</div>
                </td>
                <td className="px-4 py-2 text-xs text-navy-500/60">{new Date(n.updated_at).toLocaleString()}</td>
              </tr>
            ))}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-sm text-navy-500/60">
                {t({ th: "ไม่พบโน้ต", en: "No notes." })}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
