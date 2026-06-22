import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Volume2, Play } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { getLesson } from "@/lib/lms.functions";
import { listLessonNotes } from "@/lib/lesson-notes.functions";
import { listLessonVoice, getVoiceSignedUrl } from "@/lib/voice-records.functions";
import { NoteEditor } from "@/components/note-editor";
import { VoiceRecorder } from "@/components/voice-recorder";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/classroom/$classroomId/lesson/$lessonId")({
  component: LessonView,
});

function LessonView() {
  const { classroomId, lessonId } = useParams({ from: "/classroom/$classroomId/lesson/$lessonId" });
  const { t } = useLanguage();
  const getFn = useServerFn(getLesson);
  const notesFn = useServerFn(listLessonNotes);
  const voiceFn = useServerFn(listLessonVoice);
  const signFn = useServerFn(getVoiceSignedUrl);

  const lessonQ = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => getFn({ data: { id: lessonId } }),
  });
  const notesQ = useQuery({
    queryKey: ["lesson-notes", lessonId],
    queryFn: () => notesFn({ data: { lesson_id: lessonId } }),
  });
  const voiceQ = useQuery({
    queryKey: ["lesson-voice", lessonId],
    queryFn: () => voiceFn({ data: { lesson_id: lessonId } }),
  });

  if (lessonQ.isLoading || !lessonQ.data) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-magenta-500" />
        </div>
      </PublicLayout>
    );
  }

  const lesson = lessonQ.data;
  const myNote = (notesQ.data ?? []).find((n) => n.lesson_id === lessonId) ?? null;
  const courseId = lesson.courses?.classroom_id ? lesson.course_id : lesson.course_id;

  const play = async (path: string) => {
    const { url } = await signFn({ data: { file_path: path } });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          to="/classroom/$classroomId"
          params={{ classroomId }}
          className="inline-flex items-center gap-1 text-sm text-navy-500/70 hover:text-magenta-500"
        >
          <ArrowLeft className="h-4 w-4" /> {t({ th: "กลับห้องเรียน", en: "Back to classroom" })}
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-navy-500">{lesson.title}</h1>
        {lesson.courses && (
          <p className="text-sm text-navy-500/60">{lesson.courses.title}</p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-2xl border border-warm-200 bg-white p-6 shadow-sm">
            {lesson.body_md ? (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-navy-500">
                {lesson.body_md}
              </div>
            ) : (
              <p className="text-sm text-navy-500/60">
                {t({ th: "ยังไม่มีเนื้อหา", en: "No content yet." })}
              </p>
            )}
          </article>

          <aside className="space-y-4">
            <NoteEditor lessonId={lessonId} courseId={lesson.course_id} existing={myNote} />
            <VoiceRecorder lessonId={lessonId} courseId={lesson.course_id} onSaved={() => voiceQ.refetch()} />

            <div className="rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-500">
                {t({ th: "เสียงบันทึกของฉัน", en: "My recordings" })}
              </h3>
              <ul className="mt-2 divide-y divide-warm-200">
                {(voiceQ.data ?? []).length === 0 && (
                  <li className="py-3 text-xs text-navy-500/60">
                    {t({ th: "ยังไม่มีเสียงบันทึก", en: "No recordings yet." })}
                  </li>
                )}
                {(voiceQ.data ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-navy-500">
                      <Volume2 className="h-3.5 w-3.5" />
                      {v.title || new Date(v.created_at).toLocaleString()}
                    </span>
                    <button
                      onClick={() => play(v.file_path)}
                      className="inline-flex items-center gap-1 rounded-pill border border-warm-300 px-2 py-1 text-xs"
                    >
                      <Play className="h-3 w-3" /> {t({ th: "ฟัง", en: "Play" })}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </PublicLayout>
  );
}
