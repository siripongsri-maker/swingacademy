import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, BookOpen, Users, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { listMyClassrooms, createClassroom } from "@/lib/lms.functions";
import { useLanguage } from "@/lib/language-context";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/classroom/")({
  head: () =>
    pageHead({
      title: "ห้องเรียน — SWING Academy",
      description: "พื้นที่เรียนรู้และคลังความรู้จากชุมชน CBO ของ SWING",
      path: "/classroom",
    }),
  component: ClassroomIndex,
});

function ClassroomIndex() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyClassrooms);
  const createFn = useServerFn(createClassroom);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-classrooms"],
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: (v: { title: string; description?: string }) => createFn({ data: v }),
    onSuccess: () => {
      setShow(false);
      setTitle("");
      setDesc("");
      qc.invalidateQueries({ queryKey: ["my-classrooms"] });
    },
  });

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-navy-500">
              {t({ th: "ห้องเรียนของฉัน", en: "My classrooms" })}
            </h1>
            <p className="mt-1 text-sm text-navy-500/70">
              {t({
                th: "เลือกห้องเรียนเพื่อเริ่มเรียน จดโน้ต และอัดเสียง",
                en: "Open a classroom to start learning, take notes, and record audio",
              })}
            </p>
          </div>
          <button
            onClick={() => setShow((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-magenta-700"
          >
            <Plus className="h-4 w-4" /> {t({ th: "สร้างห้องเรียน", en: "New classroom" })}
          </button>
        </div>

        {show && (
          <div className="mt-4 rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t({ th: "ชื่อห้องเรียน", en: "Classroom title" })}
              className="w-full rounded-md border border-warm-300 px-3 py-2 text-sm"
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t({ th: "คำอธิบาย (ไม่บังคับ)", en: "Description (optional)" })}
              className="mt-2 h-20 w-full resize-y rounded-md border border-warm-300 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setShow(false)} className="rounded-pill border border-warm-300 px-3 py-1.5 text-sm">
                {t({ th: "ยกเลิก", en: "Cancel" })}
              </button>
              <button
                onClick={() => title && create.mutate({ title, description: desc || undefined })}
                disabled={!title || create.isPending}
                className="inline-flex items-center gap-1.5 rounded-pill bg-magenta-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t({ th: "สร้าง", en: "Create" })}
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-magenta-500" /></div>
        )}
        {error && (
          <p className="mt-6 text-sm text-red-600">{(error as Error).message}</p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((c) => (
            <Link
              key={c.id}
              to="/classroom/$classroomId"
              params={{ classroomId: c.id }}
              className="group overflow-hidden rounded-2xl border border-warm-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-24 bg-gradient-to-br from-magenta-500 to-lavender-500" />
              <div className="p-4">
                <h2 className="font-semibold text-navy-500 group-hover:text-magenta-500">{c.title}</h2>
                {c.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-navy-500/70">{c.description}</p>
                )}
                <div className="mt-3 flex gap-3 text-[11px] text-navy-500/60">
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> {t({ th: "บทเรียน", en: "Lessons" })}</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {t({ th: "ผู้เรียน", en: "Members" })}</span>
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && (data ?? []).length === 0 && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-warm-300 bg-white/50 p-10 text-center">
              <p className="text-sm text-navy-500/70">
                {t({
                  th: "ยังไม่มีห้องเรียน เริ่มจากปุ่ม “สร้างห้องเรียน” ด้านบน",
                  en: "No classrooms yet. Use “New classroom” above to start.",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
