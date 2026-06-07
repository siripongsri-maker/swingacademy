import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldAlert, ShieldX, Search, MessageCircle, Eye } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import { CertificatePreviewModal } from "@/components/certificate-preview-modal";
import seed from "@/data/seed-data.json";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/verify")({
  head: () =>
    pageHead({
      title: "Verify a Certificate — SWING Academy",
      description:
        "Check a SWING Academy certificate code to confirm it's genuine. See valid, expired, or unknown results and preview the issued certificate.",
      path: "/verify",
    }),
  component: VerifyPage,
});


type CertRecord = {
  code: string;
  courseId: string;
  holder: Localized;
  issued: string;
  expires: string;
  status: string;
};

type ResultState =
  | { kind: "idle" }
  | { kind: "not-found"; code: string }
  | { kind: "valid"; cert: CertRecord; course: { title: Localized } }
  | { kind: "expired"; cert: CertRecord; course: { title: Localized } };

const examples = ["SWG-PREP-2026-0112", "SWG-RRT-2024-0102", "SWG-NOTREAL-0000"];

function VerifyPage() {
  const { t, lang } = useLanguage();
  const { certificates: myCerts } = useAccount();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [previewOpen, setPreviewOpen] = useState(false);

  const publicCerts = seed.publicPortal.publicCertificates as CertRecord[];
  const courses = seed.publicPortal.courses as { id: string; title: Localized }[];
  const findCourse = (id: string) =>
    courses.find((c) => c.id === id) ?? { title: { th: "คอร์ส", en: "Course" } };

  const verify = (raw: string) => {
    const lookup = raw.trim().toUpperCase();
    if (!lookup) return;
    const all: CertRecord[] = [...publicCerts, ...(myCerts as CertRecord[])];
    const found = all.find((c) => c.code.toUpperCase() === lookup);
    if (!found) {
      setResult({ kind: "not-found", code: lookup });
      return;
    }
    const course = findCourse(found.courseId);
    const expired = found.status === "expired" || new Date(found.expires) < new Date();
    setResult({ kind: expired ? "expired" : "valid", cert: found, course });
  };

  return (
    <PublicLayout>
      <section className="border-b border-warm-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-md bg-lavender-100 text-lavender-700">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="eyebrow mb-3">{t({ th: "ตรวจสอบใบประกาศ", en: "Certificate verifier" })}</p>
          <h1 lang={lang} className="text-4xl font-semibold leading-tight text-navy-500">
            {t({
              th: "ตรวจสอบความถูกต้องของใบประกาศ",
              en: "Verify a SWING Academy certificate",
            })}
          </h1>
          <p lang={lang} className="mx-auto mt-3 max-w-xl text-lg text-warm-500">
            {t({
              th: "พิมพ์รหัสที่ปรากฏบนใบประกาศ เพื่อยืนยันว่าออกโดย SWING Academy จริง",
              en: "Enter the code on the certificate to confirm it was issued by SWING Academy.",
            })}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(code);
          }}
          className="flex flex-col gap-3 rounded-lg border border-warm-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-500" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SWG-PREP-2026-0112"
              className="w-full rounded-pill border border-warm-200 bg-cream py-3 pl-10 pr-4 font-mono text-sm text-navy-500 placeholder:text-warm-500/70 focus:border-magenta-500 focus:outline-none focus:ring-2 focus:ring-magenta-500/20"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
          >
            {t({ th: "ตรวจสอบ", en: "Verify" })}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-warm-500">
          <span lang={lang}>{t({ th: "ลองตัวอย่าง:", en: "Try an example:" })}</span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setCode(ex);
                verify(ex);
              }}
              className="rounded-pill border border-warm-200 bg-white px-2.5 py-1 font-mono text-xs text-navy-500 hover:border-magenta-500 hover:text-magenta-500"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {result.kind === "idle" && (
            <p lang={lang} className="text-center text-sm text-warm-500">
              {t({
                th: "ผลการตรวจสอบจะปรากฏที่นี่",
                en: "Your verification result will appear here.",
              })}
            </p>
          )}

          {result.kind === "valid" && (
            <ResultCard
              tone="success"
              icon={<ShieldCheck className="h-7 w-7" />}
              eyebrow={t({ th: "ใบประกาศถูกต้อง", en: "Valid certificate" })}
              title={t(result.cert.holder)}
              detail={
                <>
                  <p lang={lang}>
                    {t({ th: "สำหรับคอร์ส", en: "for" })}{" "}
                    <span className="font-semibold text-navy-500">{t(result.course.title)}</span>
                  </p>
                  <p className="mt-1">
                    {t({ th: "ออกเมื่อ", en: "Issued" })}{" "}
                    {formatDate(result.cert.issued, lang)} ·{" "}
                    {t({ th: "หมดอายุ", en: "Expires" })}{" "}
                    {formatDate(result.cert.expires, lang)}
                  </p>
                </>
              }
              code={result.cert.code}
              action={
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-success shadow-sm hover:bg-cream"
                >
                  <Eye className="h-4 w-4" />
                  {t({ th: "ดูใบประกาศ", en: "Preview certificate" })}
                </button>
              }
            />
          )}

          {result.kind === "expired" && (
            <ResultCard
              tone="warning"
              icon={<ShieldAlert className="h-7 w-7" />}
              eyebrow={t({ th: "ของจริง แต่หมดอายุแล้ว", en: "Genuine, but expired" })}
              title={t(result.cert.holder)}
              detail={
                <>
                  <p lang={lang}>
                    {t({ th: "สำหรับคอร์ส", en: "for" })}{" "}
                    <span className="font-semibold text-navy-500">{t(result.course.title)}</span>
                  </p>
                  <p className="mt-1">
                    {t({ th: "หมดอายุเมื่อ", en: "Expired on" })}{" "}
                    {formatDate(result.cert.expires, lang)}.{" "}
                    {t({
                      th: "ผู้ถือสามารถเรียนซ้ำเพื่อรับใบใหม่ได้ฟรี",
                      en: "The holder can retake the course free to renew.",
                    })}
                  </p>
                </>
              }
              code={result.cert.code}
              action={
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-gold shadow-sm hover:bg-cream"
                >
                  <Eye className="h-4 w-4" />
                  {t({ th: "ดูใบประกาศ", en: "Preview certificate" })}
                </button>
              }
            />
          )}

          {result.kind === "not-found" && (
            <ResultCard
              tone="error"
              icon={<ShieldX className="h-7 w-7" />}
              eyebrow={t({ th: "ไม่พบรหัสนี้", en: "Code not found" })}
              title={t({ th: "เราหาใบประกาศนี้ไม่เจอ", en: "We couldn't find this certificate" })}
              detail={
                <p lang={lang}>
                  {t({
                    th: "ตรวจสอบตัวสะกดอีกครั้ง หรือทักหาเราเพื่อขอความช่วยเหลือได้เลย",
                    en: "Double-check the spelling, or message us — we're happy to help.",
                  })}
                </p>
              }
              code={result.code}
              action={
                <a
                  href="https://line.me/R/ti/p/@swingthailand"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-pill bg-white px-4 py-2 text-sm font-semibold text-magenta-500 shadow-sm hover:bg-cream"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t({ th: "ทักเราที่ LINE @swingthailand", en: "Message us on LINE @swingthailand" })}
                </a>
              }
            />
          )}
        </div>
      </section>

      {(result.kind === "valid" || result.kind === "expired") && (
        <CertificatePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          courseTitle={result.course.title}
          holderName={result.cert.holder}
          issued={formatDate(result.cert.issued, lang)}
          code={result.cert.code}
        />
      )}
    </PublicLayout>
  );
}

function formatDate(iso: string, lang: "th" | "en") {
  try {
    return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function ResultCard({
  tone,
  icon,
  eyebrow,
  title,
  detail,
  code,
  action,
}: {
  tone: "success" | "warning" | "error";
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  detail: React.ReactNode;
  code: string;
  action: React.ReactNode;
}) {
  const toneStyles: Record<typeof tone, { bg: string; border: string; iconBg: string; iconColor: string; eyebrowColor: string }> = {
    success: {
      bg: "bg-success/5",
      border: "border-success/30",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      eyebrowColor: "text-success",
    },
    warning: {
      bg: "bg-gold/5",
      border: "border-gold/30",
      iconBg: "bg-gold/15",
      iconColor: "text-gold",
      eyebrowColor: "text-gold",
    },
    error: {
      bg: "bg-magenta-100",
      border: "border-magenta-500/30",
      iconBg: "bg-white",
      iconColor: "text-magenta-500",
      eyebrowColor: "text-magenta-500",
    },
  };
  const s = toneStyles[tone];

  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} p-6`}>
      <div className="flex items-start gap-4">
        <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${s.iconBg} ${s.iconColor}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className={`text-xs font-bold uppercase tracking-wider ${s.eyebrowColor}`}>
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-navy-500">{title}</h2>
          <div className="mt-2 text-sm text-warm-500">{detail}</div>
          <p className="mt-3 font-mono text-xs text-warm-500">{code}</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end">{action}</div>
    </div>
  );
}
