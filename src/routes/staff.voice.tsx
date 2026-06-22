import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Volume2, Play } from "lucide-react";
import { listAllVoiceStaff, getVoiceSignedUrl } from "@/lib/voice-records.functions";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/staff/voice")({
  component: StaffVoicePage,
});

function StaffVoicePage() {
  const { t } = useLanguage();
  const listFn = useServerFn(listAllVoiceStaff);
  const signFn = useServerFn(getVoiceSignedUrl);
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-voice"],
    queryFn: () => listFn(),
  });
  const sign = useMutation({
    mutationFn: (file_path: string) => signFn({ data: { file_path } }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-2">
        <Volume2 className="h-5 w-5 text-magenta-500" />
        <h1 className="text-2xl font-semibold text-navy-500">
          {t({ th: "เสียงบันทึกทั้งหมด", en: "All voice records" })}
        </h1>
      </div>
      <p className="mt-1 text-sm text-navy-500/70">
        {t({ th: "เสียงที่ผู้เรียนอัดในแต่ละบทเรียน", en: "Recordings learners captured per lesson" })}
      </p>

      {isLoading && <Loader2 className="mt-6 h-5 w-5 animate-spin text-magenta-500" />}
      {error && <p className="mt-4 text-sm text-red-600">{(error as Error).message}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-warm-100 text-left text-xs uppercase tracking-wider text-navy-500/60">
            <tr>
              <th className="px-4 py-2">{t({ th: "ชื่อ", en: "Title" })}</th>
              <th className="px-4 py-2">{t({ th: "บทเรียน/คอร์ส", en: "Lesson / Course" })}</th>
              <th className="px-4 py-2">{t({ th: "ผู้อัด", en: "User" })}</th>
              <th className="px-4 py-2">{t({ th: "ความยาว", en: "Duration" })}</th>
              <th className="px-4 py-2">{t({ th: "เมื่อ", en: "Created" })}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-200">
            {(data ?? []).map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2 text-navy-500">{v.title || "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {v.lessons?.title ?? "—"}
                  <div className="text-[11px] text-navy-500/60">{v.courses?.title ?? ""}</div>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{v.user_id.slice(0, 8)}…</td>
                <td className="px-4 py-2 text-xs">{v.duration_sec ?? 0}s</td>
                <td className="px-4 py-2 text-xs text-navy-500/60">{new Date(v.created_at).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => sign.mutate(v.file_path)}
                    className="inline-flex items-center gap-1 rounded-pill border border-warm-300 px-2 py-1 text-xs"
                  >
                    <Play className="h-3 w-3" /> {t({ th: "ฟัง", en: "Play" })}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-sm text-navy-500/60">
                {t({ th: "ยังไม่มีเสียง", en: "No recordings." })}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
