import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Upload,
  Play,
  Pause,
  Plus,
  X,
  Trash2,
  Sparkles,
  Save,
  ListChecks,
  StickyNote,
  Loader2,
  GripVertical,
} from "lucide-react";
import { transcribeAndOrganize, type CaptureResult } from "@/lib/capture-ai.functions";
import { useProductKnowledge } from "@/lib/product-knowledge-store";

export const Route = createFileRoute("/staff/capture")({
  component: CapturePage,
});

const DEFAULT_AGENDA = [
  "Opening",
  "Key Discussion",
  "Community Feedback",
  "Questions",
  "Action Points",
  "Learning Summary",
];

type ManualNote = { id: string; agendaIndex: number; text: string; t: number };

function formatTime(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CapturePage() {
  const pk = useProductKnowledge();
  const navigate = useNavigate();
  const processFn = useServerFn(transcribeAndOrganize);

  const [sessionTitle, setSessionTitle] = useState("");
  const [agenda, setAgenda] = useState<string[]>(DEFAULT_AGENDA);
  const [selectedAgenda, setSelectedAgenda] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState<ManualNote[]>([]);
  const [language, setLanguage] = useState<"auto" | "th" | "en">("auto");

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number | null>(null);
  const [level, setLevel] = useState(0);

  type Stage = "idle" | "transcoding" | "uploading" | "transcribing" | "done" | "error";
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageProgress, setStageProgress] = useState(0);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const r = recorderRef.current;
      if (r && r.state !== "inactive") r.stop();
      r?.stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setAudioName(`recording-${new Date().toISOString().slice(0, 16)}.webm`);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start(1000);
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setPaused(false);
      tickRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 250);
    } catch (e) {
      toast.error("ไม่สามารถเข้าถึงไมโครโฟน — กรุณาอนุญาตในเบราว์เซอร์");
    }
  }

  function pauseResume() {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state === "recording") {
      r.pause();
      setPaused(true);
      if (tickRef.current) clearInterval(tickRef.current);
    } else if (r.state === "paused") {
      r.resume();
      setPaused(false);
      startedAtRef.current = Date.now() - elapsed * 1000;
      tickRef.current = setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 250);
    }
  }

  function stopRecording() {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    if (tickRef.current) clearInterval(tickRef.current);
    setRecording(false);
    setPaused(false);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(f);
    setAudioBlob(f);
    setAudioUrl(url);
    setAudioName(f.name);
    setElapsed(0);
    setRecording(false);
  }

  function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((n) => [
      ...n,
      { id: `n_${Date.now()}`, agendaIndex: selectedAgenda, text, t: elapsed },
    ]);
    setNoteDraft("");
  }

  function removeNote(id: string) {
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  function updateAgenda(i: number, v: string) {
    setAgenda((a) => a.map((x, idx) => (idx === i ? v : x)));
  }

  function removeAgendaItem(i: number) {
    setAgenda((a) => a.filter((_, idx) => idx !== i));
    setNotes((n) =>
      n
        .filter((note) => note.agendaIndex !== i)
        .map((note) => ({
          ...note,
          agendaIndex: note.agendaIndex > i ? note.agendaIndex - 1 : note.agendaIndex,
        })),
    );
    if (selectedAgenda >= i && selectedAgenda > 0) setSelectedAgenda((s) => s - 1);
  }

  function addAgendaItem() {
    setAgenda((a) => [...a, "New section"]);
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + CHUNK)) as unknown as number[],
      );
    }
    return btoa(bin);
  }

  // Decode any browser-recorded blob (webm/opus, mp4/aac, ...) and re-encode
  // as a Gemini-friendly WAV (16-bit PCM, mono, 16kHz). Gemini does NOT
  // accept "audio/webm;codecs=opus", so we must transcode in the browser.
  async function blobToWavMono16k(blob: Blob): Promise<Blob> {
    const arrayBuf = await blob.arrayBuffer();
    const AudioCtx: typeof AudioContext =
      (window.AudioContext as typeof AudioContext) ||
      ((window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext);
    const decodeCtx = new AudioCtx();
    const decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
    await decodeCtx.close();

    const targetRate = 16000;
    const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const OfflineCtx: typeof OfflineAudioContext =
      (window.OfflineAudioContext as typeof OfflineAudioContext) ||
      ((window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
        .webkitOfflineAudioContext);
    const offline = new OfflineCtx(1, length, targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();

    const pcm = rendered.getChannelData(0);
    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, pcm.length * 2, true);
    let off = 44;
    for (let i = 0; i < pcm.length; i++, off += 2) {
      const s = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function process() {
    if (!audioBlob) {
      toast.error("กรุณาอัดเสียงหรืออัปโหลดไฟล์ก่อน");
      return;
    }
    if (audioBlob.size > 25 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (จำกัด 25MB)");
      return;
    }
    setProcessing(true);
    try {
      // Gemini supports wav/mp3/ogg/flac/aac/aiff but NOT webm. Always
      // transcode webm/mp4 recordings into 16kHz mono WAV before upload.
      let uploadBlob = audioBlob;
      let mediaType = audioBlob.type || "audio/webm";
      const needsTranscode =
        !mediaType ||
        mediaType.includes("webm") ||
        mediaType.includes("mp4") ||
        mediaType.includes("x-m4a");
      if (needsTranscode) {
        try {
          uploadBlob = await blobToWavMono16k(audioBlob);
          mediaType = "audio/wav";
        } catch (err) {
          console.error("Audio transcode failed", err);
          toast.error("ไม่สามารถแปลงไฟล์เสียง — ลองอัปโหลดเป็น mp3/wav แทน");
          setProcessing(false);
          return;
        }
      } else {
        // Strip ";codecs=..." parameters that Gemini rejects.
        mediaType = mediaType.split(";")[0].trim();
      }
      if (uploadBlob.size > 25 * 1024 * 1024) {
        toast.error("ไฟล์เสียงหลังแปลงใหญ่เกิน 25MB — ลองอัดให้สั้นลง");
        setProcessing(false);
        return;
      }
      const base64 = await blobToBase64(uploadBlob);
      const res = await processFn({
        data: {
          sessionTitle,
          agenda,
          manualNotes: notes.map(({ agendaIndex, text, t }) => ({ agendaIndex, text, t })),
          audioBase64: base64,
          audioMediaType: mediaType,
          language,
        },
      });
      setResult(res);
      toast.success("ถอดเสียงและสรุปเรียบร้อย");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process");
    } finally {
      setProcessing(false);
    }
  }

  function buildContentMd(r: CaptureResult): string {
    const parts: string[] = [];
    if (r.summary) parts.push(`## Summary\n${r.summary}`);
    if (r.takeaways.length)
      parts.push(`## Key takeaways\n${r.takeaways.map((t) => `- ${t}`).join("\n")}`);
    if (r.actionPoints.length)
      parts.push(`## Action points\n${r.actionPoints.map((t) => `- [ ] ${t}`).join("\n")}`);
    parts.push("## Agenda notes");
    r.sections.forEach((s) => {
      parts.push(`### ${s.title}\n${s.content || "_(no content)_"}`);
    });
    if (r.transcript) parts.push(`## Full transcript\n${r.transcript}`);
    return parts.join("\n\n");
  }

  function saveAsKnowledge() {
    if (!result) return;
    const titleEn = sessionTitle || `Field note — ${new Date().toLocaleDateString()}`;
    const attachments = audioUrl
      ? [
          {
            id: `att_${Date.now()}`,
            kind: "audio" as const,
            title: audioName ?? "Recording",
            externalUrl: audioUrl,
          },
        ]
      : [];
    const asset = pk.createAsset({
      titleTh: titleEn,
      titleEn,
      summary: result.summary,
      type: "field_note",
      categories: [],
      productService: "",
      audiences: [],
      keyMessage: result.takeaways[0] ?? result.summary,
      contentMd: buildContentMd(result),
      source: "Live capture session",
      sourceType: "internal",
      tags: result.tags,
      language: language === "auto" ? "th" : language,
      status: "draft",
      visibility: "staff",
      attachments,
      ownerId: "current-user",
    });
    toast.success("Saved to Knowledge Product");
    navigate({ to: "/staff/product-knowledge", search: {} });
    void asset;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Live Capture Session</h1>
        <p className="text-sm text-muted-foreground">
          อัดเสียงงานหรืออบรม แล้วให้ AI ถอดเสียงและจัดเข้า Agenda ให้อัตโนมัติ
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Session title
            </span>
            <input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="เช่น ประชุมทีม outreach 12/06"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Transcription language
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "auto" | "th" | "en")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="auto">Auto detect</option>
              <option value="th">ไทย</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </section>

      {/* Agenda editor */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-magenta-500" />
            <h2 className="text-sm font-semibold text-foreground">Agenda</h2>
          </div>
          <button
            onClick={addAgendaItem}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-warm-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add section
          </button>
        </div>
        <ul className="space-y-1.5">
          {agenda.map((a, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                selectedAgenda === i ? "border-magenta-500 bg-magenta-50/50" : "border-border bg-background"
              }`}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
              <input
                value={a}
                onChange={(e) => updateAgenda(i, e.target.value)}
                onFocus={() => setSelectedAgenda(i)}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <span className="rounded bg-warm-100 px-1.5 py-0.5 text-[10px] text-warm-700">
                {notes.filter((n) => n.agendaIndex === i).length} notes
              </span>
              <button
                onClick={() => removeAgendaItem(i)}
                className="rounded p-1 text-muted-foreground hover:bg-warm-50 hover:text-destructive"
                disabled={agenda.length <= 1}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Recording controls */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Mic className="h-4 w-4 text-magenta-500" />
          <h2 className="text-sm font-semibold text-foreground">Record or upload audio</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={!!audioBlob}
              className="inline-flex items-center gap-2 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-600 disabled:opacity-50"
            >
              <Mic className="h-4 w-4" /> Start recording
            </button>
          ) : (
            <>
              <button
                onClick={pauseResume}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-warm-50"
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={stopRecording}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
              >
                <Square className="h-4 w-4" /> Stop
              </button>
              <span className="inline-flex items-center gap-2 rounded-full bg-magenta-50 px-3 py-1 text-xs font-medium text-magenta-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-magenta-500" />
                {paused ? "Paused" : "Recording"} · {formatTime(elapsed)}
              </span>
            </>
          )}
          <span className="text-xs text-muted-foreground">หรือ</span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-magenta-500/40 bg-magenta-50 px-3 py-1.5 text-xs font-medium text-magenta-700 hover:bg-magenta-100">
            <Upload className="h-3.5 w-3.5" /> Upload audio / video
            <input type="file" accept="audio/*,video/*" hidden onChange={handleUpload} />
          </label>
          {audioBlob && (
            <button
              onClick={() => {
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                setAudioBlob(null);
                setAudioUrl(null);
                setAudioName(null);
                setElapsed(0);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Discard
            </button>
          )}
        </div>
        {audioUrl && (
          <div className="mt-3 space-y-1">
            <div className="text-xs text-muted-foreground">{audioName}</div>
            <audio src={audioUrl} controls className="w-full" />
          </div>
        )}
      </section>

      {/* Live notes */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-magenta-500" />
          <h2 className="text-sm font-semibold text-foreground">Add note to agenda</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAgenda}
            onChange={(e) => setSelectedAgenda(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {agenda.map((a, i) => (
              <option key={i} value={i}>
                {i + 1}. {a}
              </option>
            ))}
          </select>
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addNote();
            }}
            placeholder="พิมพ์ note สั้นๆ แล้วกด Enter"
            className="min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={addNote}
            className="inline-flex items-center gap-1 rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add note
          </button>
        </div>
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {notes.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <span className="mt-0.5 rounded bg-magenta-50 px-1.5 py-0.5 text-[10px] font-medium text-magenta-700">
                  {agenda[n.agendaIndex] ?? "?"} · {formatTime(n.t)}
                </span>
                <span className="flex-1 text-foreground">{n.text}</span>
                <button
                  onClick={() => removeNote(n.id)}
                  className="rounded p-1 text-muted-foreground hover:bg-warm-50 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Process */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
        <div className="text-sm text-muted-foreground">
          เมื่อพร้อม กด Process → AI จะถอดเสียง, จัดเข้าหัวข้อ Agenda, สรุป และดึง action points
        </div>
        <button
          onClick={process}
          disabled={!audioBlob || processing || recording}
          className="inline-flex items-center gap-2 rounded-md bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-magenta-600 disabled:opacity-50"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {processing ? "Processing…" : "Transcribe & Organize"}
        </button>
      </section>

      {/* Result */}
      {result && (
        <section className="space-y-4 rounded-lg border border-magenta-500/30 bg-magenta-50/30 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Smart notes</h2>
            <button
              onClick={saveAsKnowledge}
              className="inline-flex items-center gap-2 rounded-md bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Save className="h-4 w-4" /> Save to Knowledge Product
            </button>
          </div>

          {result.summary && (
            <Panel title="Summary">
              <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
            </Panel>
          )}

          {result.takeaways.length > 0 && (
            <Panel title="Key takeaways">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.takeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </Panel>
          )}

          {result.actionPoints.length > 0 && (
            <Panel title="Action points">
              <ul className="space-y-1 text-sm">
                {result.actionPoints.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Agenda notes">
            <div className="space-y-3">
              {result.sections.map((s, i) => (
                <div key={i}>
                  <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
                    {s.content || <span className="text-muted-foreground">— ไม่มีเนื้อหา</span>}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          {result.tags.length > 0 && (
            <Panel title="Recommended tags">
              <div className="flex flex-wrap gap-1.5">
                {result.tags.map((t) => (
                  <span key={t} className="rounded-full bg-magenta-100 px-2 py-0.5 text-xs text-magenta-700">
                    #{t}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {result.transcript && (
            <details className="rounded-md border border-border bg-background p-3">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Full transcript
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">{result.transcript}</p>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}
