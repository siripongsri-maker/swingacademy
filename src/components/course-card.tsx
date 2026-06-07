import { Star, Clock, Users, Award } from "lucide-react";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import seed from "@/data/seed-data.json";

export type Course = {
  id: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  durationMins: number;
  hasCertificate: boolean;
  learners: number;
  rating: number;
  title: Localized;
  tagline: Localized;
};

const categoryColor: Record<string, string> = {
  health: "#CC0099",
  rights: "#7A6FC4",
  skills: "#C9A227",
  wellbeing: "#1F8A5B",
};

export function CourseCard({ course }: { course: Course }) {
  const { t, lang } = useLanguage();
  const { signedIn, enrolled, progress } = useAccount();
  const accent = categoryColor[course.category] ?? "#CC0099";
  const levelLabel = (seed.publicPortal.levelLabel as Record<string, Localized>)[course.level];
  const isEnrolled = signedIn && enrolled.includes(course.id);
  const pct = progress[course.id] ?? 0;

  const hours = course.durationMins >= 60
    ? `${(course.durationMins / 60).toFixed(course.durationMins % 60 ? 1 : 0)}h`
    : `${course.durationMins}m`;

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-md border border-warm-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ transitionTimingFunction: "cubic-bezier(0.2,0.8,0.2,1)" }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
          >
            {t(levelLabel)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
            {t({ th: "ฟรี", en: "Free" })}
          </span>
        </div>

        <h3 lang={lang} className="text-lg font-semibold leading-snug text-navy-500">
          {t(course.title)}
        </h3>
        <p lang={lang} className="mt-1.5 text-sm text-warm-500">
          {t(course.tagline)}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-warm-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {hours}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            {course.rating.toFixed(1)}
          </span>
          {course.hasCertificate && (
            <span className="inline-flex items-center gap-1 text-gold">
              <Award className="h-3.5 w-3.5" />
              {t({ th: "ใบประกาศ", en: "Certificate" })}
            </span>
          )}
        </div>

        <div className="mt-4 flex-1" />

        {isEnrolled ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs font-medium text-navy-500">
              <span lang={lang}>
                {pct >= 100
                  ? t({ th: "เรียนจบแล้ว", en: "Completed" })
                  : t({ th: "ความคืบหน้า", en: "In progress" })}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-warm-100">
              <div
                className="h-full rounded-pill transition-all"
                style={{ width: `${pct}%`, backgroundColor: accent }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-warm-500">
            <Users className="h-3.5 w-3.5" />
            <span>
              {course.learners.toLocaleString()}{" "}
              {t({ th: "คนกำลังเรียน", en: "learners" })}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
