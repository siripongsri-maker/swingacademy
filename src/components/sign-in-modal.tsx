import { useState } from "react";
import { X, Heart, Lock } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";

export function SignInModal({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
}) {
  const { t, lang } = useLanguage();
  const { signIn, learner } = useAccount();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      signIn();
      setLoading(false);
      onSignedIn?.();
      onClose();
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-white p-7 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-pill p-1.5 text-warm-500 transition-colors hover:bg-warm-100 hover:text-navy-500"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-magenta-100 text-magenta-500">
          <Heart className="h-6 w-6" />
        </div>

        <h2 lang={lang} className="text-xl font-semibold text-navy-500">
          {t({ th: "เข้าสู่ระบบเพื่อบันทึกความคืบหน้า", en: "Sign in to save your progress" })}
        </h2>
        <p lang={lang} className="mt-2 text-sm text-warm-500">
          {t({
            th: "คุณสามารถเรียนรู้แบบไม่ระบุตัวตนได้เสมอ การเข้าสู่ระบบแค่ช่วยบันทึกความคืบหน้าและใบประกาศของคุณเท่านั้น",
            en: "You can always learn anonymously. Signing in just saves your progress and certificates.",
          })}
        </p>

        <div className="mt-5 rounded-md border border-warm-200 bg-cream p-4">
          <p className="text-xs uppercase tracking-wider text-warm-500">
            {t({ th: "เดโมผู้เรียน", en: "Demo learner" })}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-pill bg-lavender-300 text-navy-500 font-semibold">
              {learner.initial}
            </span>
            <div>
              <p lang={lang} className="font-medium text-navy-500">
                {t(learner.name)}
              </p>
              <p lang={lang} className="text-xs text-warm-500">
                {t(learner.role)} · {t(learner.site)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-warm-500">
          <Lock className="h-3.5 w-3.5" />
          <span lang={lang}>
            {t({ th: "ข้อมูลของคุณเป็นความลับเสมอ", en: "Your data is always private." })}
          </span>
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="mt-5 w-full rounded-pill bg-magenta-500 px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700 disabled:opacity-60"
        >
          {loading
            ? t({ th: "กำลังเข้าสู่ระบบ...", en: "Signing in..." })
            : t({ th: "เข้าสู่ระบบในฐานะมิว", en: "Sign in as Mew" })}
        </button>
      </div>
    </div>
  );
}
