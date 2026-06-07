import { X, Award, ShieldCheck } from "lucide-react";
import { useLanguage, type Localized } from "@/lib/language-context";

type Props = {
  open: boolean;
  onClose: () => void;
  courseTitle: Localized;
  holderName: Localized;
  issued?: string;
  code?: string;
};

export function CertificatePreviewModal({
  open,
  onClose,
  courseTitle,
  holderName,
  issued,
  code,
}: Props) {
  const { t, lang } = useLanguage();
  if (!open) return null;

  const issuedDate =
    issued ??
    new Date().toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  const certCode = code ?? `SWG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/60 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-pill p-1.5 text-warm-500 transition-colors hover:bg-warm-100 hover:text-navy-500"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pride-gradient h-2 w-full" aria-hidden />

        <div className="px-10 py-12 text-center">
          <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-pill bg-gold/15 text-gold">
            <Award className="h-7 w-7" />
          </div>
          <p className="eyebrow mb-2" style={{ color: "#C9A227" }}>
            {t({ th: "ใบประกาศสำเร็จการเรียน", en: "Certificate of completion" })}
          </p>
          <h2 className="font-serif text-2xl text-warm-500">
            {t({ th: "มอบให้แก่", en: "Awarded to" })}
          </h2>
          <p lang={lang} className="mt-3 text-4xl font-semibold text-navy-500">
            {t(holderName)}
          </p>
          <div className="mx-auto mt-5 h-px w-32 bg-warm-200" />
          <p lang={lang} className="mt-5 text-sm text-warm-500">
            {t({ th: "สำหรับการเรียนจบคอร์ส", en: "for completing" })}
          </p>
          <p lang={lang} className="mt-1 text-xl font-semibold text-navy-500">
            {t(courseTitle)}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            <div className="rounded-md border border-warm-200 bg-cream p-4">
              <p className="text-xs uppercase tracking-wider text-warm-500">
                {t({ th: "วันที่ออก", en: "Issued" })}
              </p>
              <p className="mt-1 text-sm font-medium text-navy-500">{issuedDate}</p>
            </div>
            <div className="rounded-md border border-warm-200 bg-cream p-4">
              <p className="text-xs uppercase tracking-wider text-warm-500">
                {t({ th: "รหัสตรวจสอบ", en: "Verification code" })}
              </p>
              <p className="mt-1 font-mono text-sm font-medium text-magenta-500">{certCode}</p>
            </div>
          </div>

          <div className="mt-6 inline-flex items-center gap-1.5 rounded-pill bg-lavender-100 px-3 py-1.5 text-xs font-medium text-navy-500">
            <ShieldCheck className="h-3.5 w-3.5 text-lavender-700" />
            <span lang={lang}>
              {t({
                th: "ตรวจสอบความถูกต้องได้ที่หน้าตรวจสอบ",
                en: "Verify authenticity at /verify",
              })}
            </span>
          </div>
        </div>

        <div className="border-t border-warm-200 bg-cream px-10 py-5 text-center">
          <p lang={lang} className="text-xs text-warm-500">
            {t({
              th: "ออกโดย มูลนิธิ SWING · SWING Academy",
              en: "Issued by the SWING Foundation · SWING Academy",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
