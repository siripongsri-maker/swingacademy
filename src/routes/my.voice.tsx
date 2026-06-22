import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, Volume2, Play } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { listMyVoice, deleteVoiceRecord, getVoiceSignedUrl } from "@/lib/voice-records.functions";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/my/voice")({
  component: MyVoicePage,
});

function MyVoicePage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyVoice);
  const delFn = useServerFn(deleteVoiceRecord);
  const signFn = useServerFn(getVoiceSignedUrl);
  const { data, isLoading } = useQuery({ queryKey: ["my-voice"], queryFn: () => listFn() });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-voice"] }),
  });

  const play = async (file_path: string) => {
    const { url } = await signFn({ data: { file_path } });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-magenta-500" />
          <h1 className="text-2xl font-semibold text-navy-500">
            {t({ th: "เสียงบันทึกของฉัน", en: "My voice notes" })}
          </h1>
        </div>
        {isLoading && <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-magenta-500" /></div>}
        <ul className="mt-6 space-y-3">
          {(data ?? []).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-sm font-medium text-navy-500">{v.title || t({ th: "ไม่มีชื่อ", en: "Untitled" })}</p>
                <p className="text-xs text-navy-500/60">
                  {v.courses?.title ?? ""} {v.lessons?.title ? `· ${v.lessons.title}` : ""}
                </p>
                <p className="text-[11px] text-navy-500/50">
                  {new Date(v.created_at).toLocaleString()} · {v.duration_sec ?? 0}s
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => play(v.file_path)} className="inline-flex items-center gap-1 rounded-pill border border-warm-300 px-3 py-1.5 text-xs">
                  <Play className="h-3 w-3" /> {t({ th: "ฟัง", en: "Play" })}
                </button>
                <button
                  onClick={() => confirm(t({ th: "ลบเสียงนี้?", en: "Delete this recording?" })) && del.mutate(v.id)}
                  className="rounded-pill border border-warm-300 p-1.5 text-warm-700 hover:bg-warm-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
          {!isLoading && (data ?? []).length === 0 && (
            <li className="rounded-2xl border-2 border-dashed border-warm-300 p-10 text-center text-sm text-navy-500/60">
              {t({ th: "ยังไม่มีเสียงบันทึก", en: "No recordings yet." })}
            </li>
          )}
        </ul>
      </div>
    </PublicLayout>
  );
}
