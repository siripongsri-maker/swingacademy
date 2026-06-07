import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Award, Bookmark, Sparkles, ArrowRight, BookOpen, Eye } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount, type Certificate } from "@/lib/account-context";
import { SignInModal } from "@/components/sign-in-modal";
import { CourseCard, type Course } from "@/components/course-card";
import { CertificatePreviewModal } from "@/components/certificate-preview-modal";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

type Resource = {
  id: string;
  type: string;
  meta: string | Localized;
  title: Localized;
  blurb: Localized;
};

function DashboardPage() {
  const { t, lang } = useLanguage();
  const { signedIn, learner, enrolled, saved, certificates, progress } = useAccount();
  const [signInOpen, setSignInOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState<Certificate | null>(null);

  const courses = seed.publicPortal.courses as (Course & { summary: Localized })[];
  const resources = seed.publicPortal.resources as Resource[];
  const courseById = (id: string) => courses.find((c) => c.id === id);
  const resourceById = (id: string) => resources.find((r) => r.id === id);

  if (!signedIn) {
    return (
      <PublicLayout>
        <section className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-md bg-magenta-100 text-magenta-500">
            <Heart className="h-7 w-7" />
          </div>
          <p className="eyebrow mb-3">{t({ th: "พื้นที่ของคุณ", en: "Your space" })}</p>
          <h1 lang={lang} className="text-4xl font-semibold text-navy-500">
            {t({
              th: "เข้าสู่ระบบเพื่อดูแดชบอร์ดของคุณ",
              en: "Sign in to see your dashboard",
            })}
          </h1>
          <p lang={lang} className="mx-auto mt-3 max-w-md text-lg text-warm-500">
            {t({
              th: "บันทึกความคืบหน้า ใบประกาศ และทรัพยากรที่คุณบันทึกไว้ — ทั้งหมดเป็นความลับและฟรี",
              en: "Track your progress, certificates, and saved resources — all free and private.",
            })}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setSignInOpen(true)}
              className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
            >
              {t({ th: "เข้าสู่ระบบ", en: "Sign in" })}
            </button>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-6 py-3 text-sm font-semibold text-navy-500 hover:border-magenta-500"
            >
              {t({ th: "เรียนแบบไม่ระบุตัวตน", en: "Keep browsing anonymously" })}
            </Link>
          </div>
        </section>
        <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      </PublicLayout>
    );
  }

  const continueCourses = enrolled
    .map(courseById)
    .filter((c): c is Course & { summary: Localized } => Boolean(c));
  const savedResources = saved.map(resourceById).filter((r): r is Resource => Boolean(r));
  const recommended = courses.filter((c) => !enrolled.includes(c.id)).slice(0, 3);

  return (
    <PublicLayout>
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-pill bg-lavender-300 text-xl font-semibold text-navy-500">
              {learner.initial}
            </span>
            <div className="flex-1">
              <p className="eyebrow mb-1">{t({ th: "สวัสดี", en: "Welcome back" })}</p>
              <h1 lang={lang} className="text-3xl font-semibold text-navy-500">
                {t(learner.name)}
              </h1>
              <p lang={lang} className="text-sm text-warm-500">
                {t(learner.role)} · {t(learner.site)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              icon={<BookOpen className="h-4 w-4" />}
              label={t({ th: "กำลังเรียน", en: "Enrolled" })}
              value={enrolled.length}
            />
            <StatTile
              icon={<Award className="h-4 w-4" />}
              label={t({ th: "ใบประกาศ", en: "Certificates" })}
              value={certificates.length}
            />
            <StatTile
              icon={<Bookmark className="h-4 w-4" />}
              label={t({ th: "บันทึกไว้", en: "Saved" })}
              value={saved.length}
            />
            <StatTile
              icon={<Sparkles className="h-4 w-4" />}
              label={t({ th: "เรียนจบแล้ว", en: "Completed" })}
              value={
                Object.values(progress).filter((p) => p >= 100).length
              }
            />
          </div>
        </div>
      </section>

      <Section
        title={t({ th: "เรียนต่อ", en: "Continue learning" })}
        body={t({ th: "หยิบขึ้นมาเรียนต่อจากที่ค้างไว้", en: "Pick up right where you left off." })}
      >
        {continueCourses.length === 0 ? (
          <EmptyState
            text={t({ th: "ยังไม่มีคอร์สที่ลงทะเบียน", en: "No enrolled courses yet" })}
            cta={t({ th: "เลือกคอร์ส", en: "Browse courses" })}
            to="/courses"
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {continueCourses.slice(0, 6).map((c) => (
              <Link key={c.id} to="/courses/$id" params={{ id: c.id }}>
                <CourseCard course={c} />
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={t({ th: "ใบประกาศของฉัน", en: "My certificates" })}
        body={t({
          th: "ใบประกาศที่ได้รับ — แตะเพื่อดูตัวอย่าง",
          en: "Certificates you've earned — tap to preview.",
        })}
        bg="bg-white"
      >
        {certificates.length === 0 ? (
          <EmptyState
            text={t({
              th: "ยังไม่มีใบประกาศ เรียนคอร์สแรกให้จบเพื่อรับใบประกาศ",
              en: "No certificates yet — finish a course to earn one.",
            })}
            cta={t({ th: "เริ่มเรียน", en: "Start a course" })}
            to="/courses"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => {
              const course = courseById(cert.courseId);
              return (
                <button
                  key={cert.code}
                  onClick={() => setPreviewCert(cert)}
                  className="group flex flex-col items-start overflow-hidden rounded-md border border-warm-200 bg-cream p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-gold">
                    <Award className="h-5 w-5" />
                  </div>
                  <p lang={lang} className="mt-3 text-base font-semibold text-navy-500">
                    {course ? t(course.title) : cert.courseId}
                  </p>
                  <p className="mt-1 font-mono text-xs text-warm-500">{cert.code}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-magenta-500 group-hover:text-magenta-700">
                    <Eye className="h-3.5 w-3.5" />
                    {t({ th: "ดูใบประกาศ", en: "Preview" })}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title={t({ th: "ทรัพยากรที่บันทึกไว้", en: "Saved resources" })}
        body={t({
          th: "รายการที่คุณบันทึกไว้ดูทีหลัง",
          en: "Resources you've bookmarked for later.",
        })}
      >
        {savedResources.length === 0 ? (
          <EmptyState
            text={t({ th: "ยังไม่มีทรัพยากรที่บันทึกไว้", en: "Nothing saved yet" })}
            cta={t({ th: "ไปคลังทรัพยากร", en: "Browse resources" })}
            to="/resources"
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {savedResources.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-md border border-warm-200 bg-white p-4 shadow-sm"
              >
                <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-lavender-100 text-lavender-700">
                  <Bookmark className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p lang={lang} className="text-sm font-semibold text-navy-500">
                    {t(r.title)}
                  </p>
                  <p lang={lang} className="mt-0.5 text-xs text-warm-500">
                    {t(r.blurb)}
                  </p>
                </div>
              </li>
            ))}
            <li>
              <Link
                to="/resources"
                className="flex h-full items-center justify-center gap-2 rounded-md border border-dashed border-warm-200 bg-white p-4 text-sm font-medium text-magenta-500 hover:border-magenta-500"
              >
                {t({ th: "ดูทรัพยากรทั้งหมด", en: "Browse all resources" })}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
          </ul>
        )}
      </Section>

      <Section
        title={t({ th: "แนะนำสำหรับคุณ", en: "Recommended for you" })}
        body={t({
          th: "คอร์สที่อาจตรงกับสิ่งที่คุณกำลังเรียนอยู่",
          en: "Courses that build on what you're already learning.",
        })}
        bg="bg-white"
      >
        {recommended.length === 0 ? (
          <EmptyState
            text={t({
              th: "คุณได้ลงทะเบียนทุกคอร์สแล้ว เก่งมาก!",
              en: "You've enrolled in every course — amazing!",
            })}
            cta={t({ th: "ดูเส้นทางเรียนรู้", en: "See learning paths" })}
            to="/paths"
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((c) => (
              <Link key={c.id} to="/courses/$id" params={{ id: c.id }}>
                <CourseCard course={c} />
              </Link>
            ))}
          </div>
        )}
      </Section>

      {previewCert && (
        <CertificatePreviewModal
          open={Boolean(previewCert)}
          onClose={() => setPreviewCert(null)}
          courseTitle={
            courseById(previewCert.courseId)?.title ?? {
              th: previewCert.courseId,
              en: previewCert.courseId,
            }
          }
          holderName={previewCert.holder}
          issued={previewCert.issued}
          code={previewCert.code}
        />
      )}
    </PublicLayout>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-warm-200 bg-cream p-3">
      <div className="flex items-center gap-2 text-xs text-warm-500">
        <span className="text-magenta-500">{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-navy-500">{value}</p>
    </div>
  );
}

function Section({
  title,
  body,
  children,
  bg = "bg-cream",
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <section className={bg}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-navy-500">{title}</h2>
            <p className="mt-1 text-sm text-warm-500">{body}</p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

function EmptyState({ text, cta, to }: { text: string; cta: string; to: string }) {
  return (
    <div className="rounded-lg border border-dashed border-warm-200 bg-white p-8 text-center">
      <p className="text-sm text-warm-500">{text}</p>
      <Link
        // @ts-expect-error simple string nav for stub
        to={to}
        className="mt-3 inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
