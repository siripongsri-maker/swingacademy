import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { getClassroom, createCourse, createLesson } from "@/lib/lms.functions";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/classroom/$classroomId")({
  component: ClassroomDetail,
});

function ClassroomDetail() {
  const { classroomId } = useParams({ from: "/classroom/$classroomId" });
  const { t } = useLanguage();
  const qc = useQueryClient();
  const getFn = useServerFn(getClassroom);
  const createCourseFn = useServerFn(createCourse);
  const createLessonFn = useServerFn(createLesson);
  const [newCourse, setNewCourse] = useState("");
  const [lessonDraft, setLessonDraft] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["classroom", classroomId],
    queryFn: () => getFn({ data: { id: classroomId } }),
  });

  const addCourse = useMutation({
    mutationFn: (title: string) => createCourseFn({ data: { classroom_id: classroomId, title } }),
    onSuccess: () => {
      setNewCourse("");
      qc.invalidateQueries({ queryKey: ["classroom", classroomId] });
    },
  });

  const addLesson = useMutation({
    mutationFn: (v: { course_id: string; title: string }) => createLessonFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classroom", classroomId] }),
  });

  if (isLoading || !data) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-magenta-500" />
        </div>
      </PublicLayout>
    );
  }

  const { classroom, courses, lessons } = data;
  const lessonsByCourse = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const arr = lessonsByCourse.get(l.course_id) ?? [];
    arr.push(l);
    lessonsByCourse.set(l.course_id, arr);
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link to="/classroom" className="inline-flex items-center gap-1 text-sm text-navy-500/70 hover:text-magenta-500">
          <ArrowLeft className="h-4 w-4" /> {t({ th: "ห้องเรียนทั้งหมด", en: "All classrooms" })}
        </Link>

        <div className="mt-3 rounded-2xl bg-gradient-to-br from-magenta-500 to-lavender-500 p-6 text-white shadow-sm">
          <h1 className="text-2xl font-semibold">{classroom.title}</h1>
          {classroom.description && <p className="mt-1 text-sm text-white/90">{classroom.description}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <input
            value={newCourse}
            onChange={(e) => setNewCourse(e.target.value)}
            placeholder={t({ th: "ชื่อคอร์สใหม่…", en: "New course title…" })}
            className="flex-1 rounded-md border border-warm-300 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={() => newCourse && addCourse.mutate(newCourse)}
            disabled={!newCourse || addCourse.isPending}
            className="inline-flex items-center gap-1.5 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {t({ th: "เพิ่มคอร์ส", en: "Add course" })}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {courses.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-warm-300 bg-white/50 p-8 text-center text-sm text-navy-500/70">
              {t({ th: "ยังไม่มีคอร์สในห้องนี้", en: "No courses in this classroom yet." })}
            </div>
          )}
          {courses.map((c) => {
            const ls = lessonsByCourse.get(c.id) ?? [];
            const draft = lessonDraft[c.id] ?? "";
            return (
              <div key={c.id} className="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-magenta-500" />
                    <h2 className="font-semibold text-navy-500">{c.title}</h2>
                  </div>
                  <span className="text-xs text-navy-500/60">{ls.length} {t({ th: "บทเรียน", en: "lessons" })}</span>
                </div>
                {c.description && <p className="mt-1 text-sm text-navy-500/70">{c.description}</p>}

                <ul className="mt-3 divide-y divide-warm-200">
                  {ls.map((l) => (
                    <li key={l.id} className="py-2">
                      <Link
                        to="/classroom/$classroomId/lesson/$lessonId"
                        params={{ classroomId, lessonId: l.id }}
                        className="flex items-center justify-between text-sm text-navy-500 hover:text-magenta-500"
                      >
                        <span>{l.title}</span>
                        <span className="text-xs text-magenta-500">{t({ th: "เข้าเรียน →", en: "Open →" })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setLessonDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                    placeholder={t({ th: "เพิ่มบทเรียน…", en: "Add lesson…" })}
                    className="flex-1 rounded-md border border-warm-300 bg-white px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!draft) return;
                      addLesson.mutate({ course_id: c.id, title: draft });
                      setLessonDraft((d) => ({ ...d, [c.id]: "" }));
                    }}
                    className="inline-flex items-center gap-1 rounded-pill bg-navy-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3 w-3" /> {t({ th: "เพิ่ม", en: "Add" })}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}
