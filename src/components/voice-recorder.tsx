import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Save, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createVoiceRecord } from "@/lib/voice-records.functions";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";

type Props = {
  lessonId?: string;
  courseId?: string;
  onSaved?: () => void;
};

export function VoiceRecorder({ lessonId, courseId, onSaved }: Props) {
  const { t } = useLanguage();
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const create = useServerFn(createVoiceRecord);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, [url]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast.error(t({ th: "ไม่สามารถเข้าถึงไมโครโฟน", en: "Cannot access microphone" }));
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const discard = () => {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setSeconds(0);
    setTitle("");
  };

  const save = async () => {
    if (!blob) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = (blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm");
      const path = `voice/${u.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("training-attachments")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      await create({
        data: {
          file_path: path,
          lesson_id: lessonId ?? null,
          course_id: courseId ?? null,
          title: title || null,
          duration_sec: seconds,
          mime: blob.type,
        },
      });
      toast.success(t({ th: "บันทึกเสียงเรียบร้อย", en: "Voice saved" }));
      discard();
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-magenta-500" />
          <h3 className="text-sm font-semibold text-navy-500">
            {t({ th: "บันทึกเสียง", en: "Voice recorder" })}
          </h3>
        </div>
        <span className="font-mono text-sm tabular-nums text-navy-500/70">{mm}:{ss}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!recording && !blob && (
          <button onClick={start} className="inline-flex items-center gap-1.5 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700">
            <Mic className="h-4 w-4" /> {t({ th: "เริ่มอัด", en: "Record" })}
          </button>
        )}
        {recording && (
          <button onClick={stop} className="inline-flex items-center gap-1.5 rounded-pill bg-navy-500 px-4 py-2 text-sm font-semibold text-white">
            <Square className="h-4 w-4" /> {t({ th: "หยุด", en: "Stop" })}
          </button>
        )}
        {blob && url && (
          <>
            <audio src={url} controls className="h-9" />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t({ th: "ตั้งชื่อเสียง (ไม่บังคับ)", en: "Title (optional)" })}
              className="flex-1 min-w-[160px] rounded-md border border-warm-300 bg-white px-3 py-1.5 text-sm"
            />
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-pill bg-magenta-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t({ th: "บันทึก", en: "Save" })}
            </button>
            <button onClick={discard} className="inline-flex items-center gap-1.5 rounded-pill border border-warm-300 px-3 py-2 text-sm font-medium text-navy-500">
              <Trash2 className="h-4 w-4" /> {t({ th: "ทิ้ง", en: "Discard" })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
