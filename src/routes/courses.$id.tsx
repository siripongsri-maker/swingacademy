import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronRight,
  Clock,
  Star,
  Users,
  Award,
  PlayCircle,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ShieldCheck,
  Heart,
  Send,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { CertificatePreviewModal } from "@/components/certificate-preview-modal";
import { SignInModal } from "@/components/sign-in-modal";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import seed from "@/data/seed-data.json";


type Lesson = { id: string; type: "video" | "reading" | "quiz"; mins: number; title: Localized };
type CourseFull = {
  id: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  durationMins: number;
  funderId: string;
  facilitatorId: string;
  hasCertificate: boolean;
  learners: number;
  rating: number;
  title: Localized;
  tagline: Localized;
  summary: Localized;
  reassure: string[];
  glossaryKeys: string[];
  outcomes: Localized[];
  lessons: Lesson[];
};

const categoryColor: Record<string, string> = {
  health: "#CC0099",
  rights: "#7A6FC4",
  skills: "#C9A227",
  wellbeing: "#1F8A5B",
};

export const Route = createFileRoute("/courses/$id")({
  loader: ({ params }) => {
    const course = (seed.publicPortal.courses as CourseFull[]).find((c) => c.id === params.id);
    if (!course) throw notFound();
    return { course };
  },
  component: CourseDetail,
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold text-navy-500">Course not found</h1>
        <Link
          to="/courses"
          className="mt-6 inline-flex rounded-pill bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Browse all courses
        </Link>
      </div>
    </PublicLayout>
  ),
});

const lessonIcons = {
  video: PlayCircle,
  reading: BookOpen,
  quiz: CheckCircle2,
} as const;

function CourseDetail() {
  const { course } = Route.useLoaderData() as { course: CourseFull };
  const { t, lang } = useLanguage();
  const { signedIn, enrolled, progress, signIn, enroll, learner } = useAccount();

  const [signInOpen, setSignInOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  const accent = categoryColor[course.category] ?? "#CC0099";
  const isEnrolled = signedIn && enrolled.includes(course.id);
  const pct = progress[course.id] ?? 0;
  const isCompleted = isEnrolled && pct >= 100;

  const reassurances = seed.publicPortal.reassurances as Record<string, Localized>;
  const glossary = seed.publicPortal.glossary as Record<string, Localized>;
  const facilitators = seed.publicPortal.facilitators as {
    id: string;
    initial: string;
    name: Localized;
    role: Localized;
    site: string;
  }[];
  const facilitator = facilitators.find((f) => f.id === course.facilitatorId);
  const levelLabel = (seed.publicPortal.levelLabel as Record<string, Localized>)[course.level];
  const category = (seed.publicPortal.categories as { id: string; name: Localized }[]).find(
    (c) => c.id === course.category,
  );

  const hours =
    course.durationMins >= 60
      ? `${(course.durationMins / 60).toFixed(course.durationMins % 60 ? 1 : 0)}h`
      : `${course.durationMins}m`;

  const handleStart = () => {
    if (!signedIn) {
      setSignInOpen(true);
      return;
    }
    enroll(course.id);
  };

  const handleSignInThenEnroll = () => {
    signIn();
    enroll(course.id);
    setSignInOpen(false);
  };

  return (
    <PublicLayout>
      {/* Breadcrumb */}
      <div className="border-b border-warm-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-1.5 px-6 py-3 text-sm text-warm-500">
          <Link to="/" className="hover:text-magenta-500">
            {t({ th: "หน้าแรก", en: "Home" })}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/courses" className="hover:text-magenta-500">
            {t({ th: "คอร์ส", en: "Courses" })}
          </Link>
          {category && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span lang={lang} style={{ color: accent }} className="font-medium">
                {t(category.name)}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Header */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-32 right-0 h-80 w-80 rounded-full blur-3xl opacity-30"
          style={{ backgroundColor: accent }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-12 pb-10 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `${accent}1A`, color: accent }}
              >
                {category && t(category.name)}
              </span>
              <span className="inline-flex items-center rounded-pill bg-warm-100 px-3 py-1 text-xs font-semibold text-navy-500">
                {t(levelLabel)}
              </span>
              <span className="inline-flex items-center rounded-pill bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {t({ th: "ฟรี", en: "Free" })}
              </span>
            </div>

            <h1 lang={lang} className="text-3xl font-semibold text-navy-500 md:text-5xl">
              {t(course.title)}
            </h1>
            <p lang={lang} className="mt-3 text-lg text-warm-500">
              {t(course.tagline)}
            </p>
            <p lang={lang} className="mt-5 text-base text-navy-500/80">
              {t(course.summary)}
            </p>

            {/* Reassurance row */}
            <div className="mt-6 flex flex-wrap gap-2">
              {course.reassure.map((key) => {
                const label = reassurances[key];
                if (!label) return null;
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-500"
                  >
                    <Heart className="h-3.5 w-3.5 text-magenta-500" />
                    <span lang={lang}>{t(label)}</span>
                  </span>
                );
              })}
            </div>

            {/* Meta */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-warm-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {hours}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-gold text-gold" /> {course.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {course.learners.toLocaleString()}{" "}
                {t({ th: "ผู้เรียน", en: "learners" })}
              </span>
              {course.hasCertificate && (
                <span className="inline-flex items-center gap-1.5 text-gold">
                  <Award className="h-4 w-4" /> {t({ th: "ใบประกาศ", en: "Certificate" })}
                </span>
              )}
            </div>
          </div>

          {/* Right rail: CTA + facilitator */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-warm-200 bg-white p-6 shadow-md">
              {isEnrolled && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs font-medium text-navy-500">
                    <span lang={lang}>
                      {isCompleted
                        ? t({ th: "เรียนจบแล้ว", en: "Completed" })
                        : t({ th: "ความคืบหน้า", en: "Progress" })}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-warm-100">
                    <div
                      className="h-full rounded-pill transition-all"
                      style={{ width: `${pct}%`, backgroundColor: accent }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleStart}
                className="w-full rounded-pill bg-magenta-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
              >
                {isCompleted
                  ? t({ th: "ทบทวนอีกครั้ง", en: "Review again" })
                  : isEnrolled
                    ? t({ th: "เรียนต่อ", en: "Continue" })
                    : t({ th: "เริ่มเรียน", en: "Start" })}
              </button>

              {isCompleted && course.hasCertificate && (
                <button
                  onClick={() => setCertOpen(true)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-pill border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition-all hover:bg-gold/20"
                  style={{ color: "#A07F1F" }}
                >
                  <Award className="h-4 w-4" />
                  {t({ th: "ดูใบประกาศ", en: "View certificate" })}
                </button>
              )}

              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-warm-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span lang={lang}>
                  {t({ th: "ฟรีและเป็นความลับ", en: "Free and private" })}
                </span>
              </p>
            </div>

            {facilitator && (
              <div className="rounded-lg border border-warm-200 bg-white p-5 shadow-sm">
                <p className="eyebrow mb-3">{t({ th: "พี่เลี้ยงประจำคอร์ส", en: "Your facilitator" })}</p>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-lavender-300 text-navy-500 font-semibold">
                    {facilitator.initial}
                  </span>
                  <div>
                    <p lang={lang} className="font-semibold text-navy-500">
                      {t(facilitator.name)}
                    </p>
                    <p lang={lang} className="text-xs text-warm-500">
                      {t(facilitator.role)} · {facilitator.site}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {/* Main body */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[2fr_1fr]">
          {/* Left column */}
          <div className="space-y-12">
            {/* Outcomes */}
            <div>
              <h2 lang={lang} className="text-2xl font-semibold text-navy-500">
                {t({ th: "สิ่งที่คุณจะได้เรียนรู้", en: "What you'll learn" })}
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {course.outcomes.map((o, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-warm-200 bg-cream p-4"
                  >
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0"
                      style={{ color: accent }}
                    />
                    <span lang={lang} className="text-sm text-navy-500">
                      {t(o)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Lessons */}
            <div>
              <h2 lang={lang} className="text-2xl font-semibold text-navy-500">
                {t({ th: "บทเรียน", en: "Lessons" })}
              </h2>
              <p className="mt-1 text-sm text-warm-500">
                {course.lessons.length} {t({ th: "บทเรียน", en: "lessons" })} · {hours}
              </p>
              <ol className="mt-5 overflow-hidden rounded-md border border-warm-200 bg-white">
                {course.lessons.map((l, i) => {
                  const Icon = lessonIcons[l.type];
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-4 border-b border-warm-200 px-5 py-4 last:border-b-0"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-warm-100 text-xs font-bold text-navy-500">
                        {i + 1}
                      </span>
                      <Icon className="h-5 w-5 shrink-0" style={{ color: accent }} />
                      <div className="flex-1">
                        <p lang={lang} className="text-sm font-medium text-navy-500">
                          {t(l.title)}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-warm-500">
                          {l.type}
                        </p>
                      </div>
                      <span className="text-xs text-warm-500">{l.mins}m</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Feedback */}
            <FeedbackForm />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Glossary */}
            {course.glossaryKeys.length > 0 && (
              <div className="rounded-lg border border-warm-200 bg-cream p-6">
                <div className="mb-3 flex items-center gap-2">
                  <CircleHelp className="h-5 w-5 text-lavender-700" />
                  <h3 lang={lang} className="text-lg font-semibold text-navy-500">
                    {t({ th: "คำศัพท์ในคอร์สนี้", en: "Glossary" })}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {course.glossaryKeys.map((k) => {
                    const def = glossary[k];
                    if (!def) return null;
                    return (
                      <li key={k} lang={lang} className="text-sm text-navy-500">
                        {t(def)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Certificate note */}
            {course.hasCertificate && (
              <div className="rounded-lg border p-6"
                style={{ borderColor: "#C9A22740", backgroundColor: "#C9A2270D" }}>
                <div className="mb-2 flex items-center gap-2">
                  <Award className="h-5 w-5 text-gold" />
                  <h3 lang={lang} className="text-lg font-semibold text-navy-500">
                    {t({ th: "รับใบประกาศ", en: "Earn a certificate" })}
                  </h3>
                </div>
                <p lang={lang} className="text-sm text-warm-700">
                  {t({
                    th: "เรียนจบรับใบประกาศของมูลนิธิ SWING ไปใช้สมัครงานหรือเก็บไว้เป็นความภูมิใจ",
                    en: "Finish this course to earn a SWING Foundation certificate — use it for jobs or just keep it as something to be proud of.",
                  })}
                </p>
                {isCompleted && (
                  <button
                    onClick={() => setCertOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline"
                    style={{ color: "#A07F1F" }}
                  >
                    {t({ th: "ดูใบประกาศของคุณ", en: "View your certificate" })}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <SignInModalWithEnroll
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onConfirm={handleSignInThenEnroll}
      />

      {course.hasCertificate && (
        <CertificatePreviewModal
          open={certOpen}
          onClose={() => setCertOpen(false)}
          courseTitle={course.title}
          holderName={signedIn ? learner.name : { th: "ผู้เรียน", en: "Learner" }}
        />
      )}
    </PublicLayout>
  );
}

function SignInModalWithEnroll({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // Reuse the standard sign-in modal but trigger enroll on success via callback handled inline.
  // The base modal signs in via context, so wrap close behavior: when modal closes after sign-in,
  // we still need to enroll. Simplest: render base modal and on open use a small auto-effect.
  return <SignInModal open={open} onClose={onClose} onSignedIn={onConfirm} />;
}

function FeedbackForm() {
  const { t, lang } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
        <p lang={lang} className="font-semibold text-navy-500">
          {t({ th: "ขอบคุณสำหรับความเห็น", en: "Thanks for your feedback!" })}
        </p>
        <p lang={lang} className="mt-1 text-sm text-warm-500">
          {t({
            th: "เสียงของคุณช่วยให้เราพัฒนาคอร์สให้ดีขึ้น",
            en: "Your voice helps us make courses better.",
          })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-warm-200 bg-white p-6">
      <h2 lang={lang} className="text-xl font-semibold text-navy-500">
        {t({ th: "ให้ความเห็นกับคอร์สนี้", en: "Share your feedback" })}
      </h2>
      <p lang={lang} className="mt-1 text-sm text-warm-500">
        {t({
          th: "ทุกความคิดเห็นเป็นความลับ",
          en: "All feedback is anonymous and private.",
        })}
      </p>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-warm-500">
          {t({ th: "ให้คะแนน", en: "Rating" })}
        </p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              aria-label={`${n} stars`}
              className="rounded p-1"
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  (hover || rating) >= n ? "fill-gold text-gold" : "text-warm-300"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="comment"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-warm-500"
        >
          {t({ th: "ความคิดเห็น (ไม่บังคับ)", en: "Comment (optional)" })}
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder={t({
            th: "บอกเราว่ารู้สึกอย่างไร...",
            en: "Tell us what you think...",
          })}
          className="w-full resize-none rounded-md border border-warm-200 bg-cream p-3 text-sm text-navy-500 outline-none transition-colors placeholder:text-warm-400 focus:border-magenta-500"
        />
      </div>

      <button
        type="submit"
        disabled={!rating}
        className="mt-5 inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-magenta-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
        {t({ th: "ส่งความเห็น", en: "Submit feedback" })}
      </button>
    </form>
  );
}
