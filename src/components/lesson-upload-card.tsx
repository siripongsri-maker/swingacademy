import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Video, FileText, Link as LinkIcon, Trash2, Loader2, CheckCircle2, GripVertical, X } from "lucide-react";
import {
  createAttachmentUploadUrl,
  saveLessonAttachment,
  listLessonAttachments,
  deleteLessonAttachment,
} from "@/lib/lesson-attachments.functions";
import seed from "@/data/seed-data.json";

type Course = { id: string; title?: { th?: string; en?: string } | string };

export function LessonUploadCard() {
  const courses = ((seed as any).publicPortal?.courses ?? []) as Course[];
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "c_prep");
  const [lessonId, setLessonId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [published, setPublished] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const qc = useQueryClient();
  const list = useServerFn(listLessonAttachments);
  const createUrl = useServerFn(createAttachmentUploadUrl);
  const save = useServerFn(saveLessonAttachment);
  const del = useServerFn(deleteLessonAttachment);

  const { data, isLoading } = useQuery({
    queryKey: ["lesson-attachments", courseId],
    queryFn: () => list({ data: { courseId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["lesson-attachments", courseId] });

  async function uploadFile(file: File, kind: "slides" | "video") {
    const { path, signedUrl, token } = await createUrl({
      data: { courseId, kind, filename: file.name },
    });
    // Upload to the signed URL
    const res = await fetch(signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return path;
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (slideFiles.length === 0 && !videoFile && !videoUrl) {
        throw new Error("Add slides, a video file, or a video URL.");
      }
      const results: any[] = [];
      for (let i = 0; i < slideFiles.length; i++) {
        const f = slideFiles[i];
        const path = await uploadFile(f, "slides");
        const baseTitle = title || f.name;
        const slideTitle = slideFiles.length > 1 ? `${baseTitle} (${i + 1}/${slideFiles.length})` : baseTitle;
        results.push(
          await save({
            data: {
              courseId, lessonId: lessonId || null, kind: "slides",
              storagePath: path, title: slideTitle,
              description: description || null, language, published,
            },
          }),
        );
      }
      if (videoFile) {
        const path = await uploadFile(videoFile, "video");
        results.push(
          await save({
            data: {
              courseId, lessonId: lessonId || null, kind: "video",
              storagePath: path, title: title || videoFile.name,
              description: description || null, language, published,
            },
          }),
        );
      }
      if (videoUrl) {
        results.push(
          await save({
            data: {
              courseId, lessonId: lessonId || null, kind: "video_url",
              externalUrl: videoUrl, title: title || videoUrl,
              description: description || null, language, published,
            },
          }),
        );
      }
      return results;
    },
    onSuccess: () => {
      setMsg({ kind: "ok", text: "Saved." });
      setSlideFiles([]); setVideoFile(null); setVideoUrl("");
      setTitle(""); setDescription(""); setLessonId("");
      refresh();
    },
    onError: (e: any) => setMsg({ kind: "err", text: e?.message ?? "Upload failed" }),
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: refresh,
  });

  const attachments = data?.attachments ?? [];

  return (
    <section className="rounded-lg border border-warm-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Lesson capture</p>
          <h2 className="mt-1 text-xl font-semibold text-navy-500">Record &amp; slide upload</h2>
          <p className="mt-1 text-sm text-warm-500">
            Upload slide decks (PDF/PPT) and lesson recordings (file or URL). Files are stored privately and
            served via short-lived signed URLs.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Course">
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm text-navy-500"
          >
            {courses.map((c) => {
              const label = typeof c.title === "string" ? c.title : c.title?.en ?? c.title?.th ?? c.id;
              return <option key={c.id} value={c.id}>{label} ({c.id})</option>;
            })}
          </select>
        </Field>
        <Field label="Lesson ID (optional)">
          <input
            value={lessonId} onChange={(e) => setLessonId(e.target.value)}
            placeholder="e.g. l_prep_intro"
            className="w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm text-navy-500"
          />
        </Field>
        <Field label="Title">
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson title"
            className="w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm text-navy-500"
          />
        </Field>
        <Field label="Language">
          <div className="flex gap-2">
            {(["th", "en"] as const).map((l) => (
              <button
                key={l} type="button" onClick={() => setLanguage(l)}
                className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${
                  language === l ? "border-magenta-500 bg-magenta-500 text-white" : "border-warm-200 bg-white text-warm-700"
                }`}
              >{l.toUpperCase()}</button>
            ))}
            <label className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-warm-700">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Publish
            </label>
          </div>
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm text-navy-500"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-dashed border-warm-200 bg-warm-50 p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-navy-500">
            <FileText className="h-5 w-5" /> Slides (PDF / PPT / PPTX)
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-500 hover:border-magenta-500">
            <Upload className="h-3.5 w-3.5" /> Add slide files
            <input
              type="file" multiple
              accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length) setSlideFiles((prev) => [...prev, ...picked]);
                e.target.value = "";
              }}
            />
          </label>
          {slideFiles.length === 0 ? (
            <p className="mt-2 text-[11px] text-warm-500">No files selected. Drag rows to reorder once added.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {slideFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx === null || dragIdx === i) return;
                    setSlideFiles((prev) => {
                      const next = prev.slice();
                      const [moved] = next.splice(dragIdx, 1);
                      next.splice(i, 0, moved);
                      return next;
                    });
                    setDragIdx(null);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  className={`flex items-center gap-2 rounded-md border bg-white px-2 py-1.5 text-xs ${
                    dragIdx === i ? "border-magenta-500 opacity-60" : "border-warm-200"
                  }`}
                >
                  <GripVertical className="h-3.5 w-3.5 cursor-grab text-warm-400" />
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-warm-100 text-[10px] font-semibold text-navy-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-navy-500">{f.name}</span>
                  <span className="shrink-0 text-[10px] text-warm-500">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                  <button
                    type="button"
                    onClick={() => setSlideFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="rounded p-0.5 text-warm-500 hover:bg-warm-50 hover:text-danger"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DropZone
          icon={<Video className="h-5 w-5" />}
          label="Recording (MP4 / WebM / MOV)"
          accept="video/mp4,video/webm,video/quicktime"
          file={videoFile}
          onFile={setVideoFile}
        />
        <div className="rounded-md border border-dashed border-warm-200 bg-warm-50 p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-navy-500">
            <LinkIcon className="h-5 w-5" /> Video URL
          </div>
          <input
            value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/…"
            className="w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm text-navy-500"
          />
          <p className="mt-2 text-[11px] text-warm-500">Paste a YouTube, Vimeo, or Drive link.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => { setMsg(null); submit.mutate(); }}
          disabled={submit.isPending}
          className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Save attachment
        </button>
        {msg && (
          <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${msg.kind === "ok" ? "text-success" : "text-danger"}`}>
            {msg.kind === "ok" && <CheckCircle2 className="h-4 w-4" />} {msg.text}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-navy-500">Attachments for this course</h3>
        {isLoading ? (
          <p className="text-xs text-warm-500">Loading…</p>
        ) : attachments.length === 0 ? (
          <p className="text-xs text-warm-500">No attachments yet.</p>
        ) : (
          <ul className="divide-y divide-warm-100 rounded-md border border-warm-200">
            {attachments.map((a: any) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {a.kind === "slides" ? <FileText className="h-4 w-4 text-warm-500" /> : <Video className="h-4 w-4 text-warm-500" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-500">{a.title ?? a.kind}</p>
                  <p className="truncate text-[11px] text-warm-500">
                    {a.kind} · {a.language?.toUpperCase()} · {a.published ? "published" : "draft"}
                    {a.lesson_id ? ` · ${a.lesson_id}` : ""}
                  </p>
                </div>
                {(a.signedUrl || a.external_url) && (
                  <a
                    href={a.signedUrl ?? a.external_url} target="_blank" rel="noreferrer"
                    className="text-xs font-semibold text-magenta-500 hover:underline"
                  >Open</a>
                )}
                <button
                  onClick={() => removeOne.mutate(a.id)}
                  className="rounded-md p-1.5 text-warm-500 hover:bg-warm-50 hover:text-danger"
                  aria-label="Delete"
                ><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-warm-500">{label}</span>
      {children}
    </label>
  );
}

function DropZone({
  icon, label, accept, file, onFile,
}: {
  icon: React.ReactNode; label: string; accept: string;
  file: File | null; onFile: (f: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-2 rounded-md border border-dashed border-warm-200 bg-warm-50 p-4 hover:border-magenta-500">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-navy-500">{icon} {label}</div>
      <input
        type="file" accept={accept} className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <p className="truncate text-[11px] text-warm-500">
        {file ? `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : "Click to choose a file"}
      </p>
      {file && (
        <button type="button" onClick={(e) => { e.preventDefault(); onFile(null); }}
          className="self-start text-[11px] font-semibold text-magenta-500 hover:underline">
          Clear
        </button>
      )}
    </label>
  );
}
