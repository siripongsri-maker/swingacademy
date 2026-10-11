import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useConsoleRole } from "@/lib/console-role-context";
import { useLanguage } from "@/lib/language-context";

/**
 * Client-side gate for the staff console. Sessions live in the browser, so SSR
 * always renders the checking state and the real check runs after hydration
 * (ConsoleRoleProvider: session + getMyRoles, re-run on auth state changes).
 * Server functions still enforce access on their own (requireStaff /
 * requireAdmin); this gate keeps the console UI away from anyone without a
 * staff | trainer | admin | superadmin role.
 */
export function StaffAccessGate({ children }: { children: ReactNode }) {
  const { access, recheck } = useConsoleRole();
  const navigate = useNavigate();

  useEffect(() => {
    // /auth sends staff accounts back to /staff after sign-in.
    if (access === "signed-out") navigate({ to: "/auth", replace: true });
  }, [access, navigate]);

  if (access === "ready") return <>{children}</>;
  if (access === "denied") return <NoAccess />;
  if (access === "error") return <CheckFailed onRetry={recheck} />;
  return <Checking />;
}

function Checking() {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-warm-50 px-6"
    >
      <Loader2 className="h-6 w-6 animate-spin text-magenta-500" />
      <p className="mt-3 text-sm text-warm-500">
        {t({ th: "กำลังตรวจสอบสิทธิ์…", en: "Checking your access…" })}
      </p>
    </div>
  );
}

function NoAccess() {
  const { t, lang } = useLanguage();
  return (
    <PublicLayout>
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-md bg-magenta-100 text-magenta-500">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 lang={lang} className="text-3xl font-semibold text-navy-500">
          {t({
            th: "บัญชีนี้ยังเข้าหลังบ้านไม่ได้",
            en: "This account can't open the staff console yet",
          })}
        </h1>
        <p lang={lang} className="mx-auto mt-3 max-w-md text-base text-warm-500">
          {t({
            th: "หลังบ้านเปิดให้เจ้าหน้าที่ ผู้สอน และผู้ดูแลระบบ ถ้าคุณเป็นทีมงานและต้องการสิทธิ์ ติดต่อผู้ดูแลระบบได้เลย",
            en: "The staff console is for staff, trainers, and admins. If you're on the team and need access, please contact an admin.",
          })}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
          >
            {t({ th: "กลับหน้าแรก", en: "Back to home" })}
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-6 py-3 text-sm font-semibold text-navy-500 hover:border-magenta-500"
          >
            {t({ th: "ไปที่แดชบอร์ดของฉัน", en: "Go to my dashboard" })}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

function CheckFailed({ onRetry }: { onRetry: () => void }) {
  const { t, lang } = useLanguage();
  return (
    <PublicLayout>
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-md bg-magenta-100 text-magenta-500">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 lang={lang} className="text-3xl font-semibold text-navy-500">
          {t({ th: "ตรวจสอบสิทธิ์ไม่สำเร็จ", en: "We couldn't check your access" })}
        </h1>
        <p lang={lang} className="mx-auto mt-3 max-w-md text-base text-warm-500">
          {t({
            th: "อาจเป็นเพราะการเชื่อมต่อขัดข้อง ลองอีกครั้งได้เลย",
            en: "This may be a connection issue. Please try again.",
          })}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-magenta-700"
          >
            {t({ th: "ลองอีกครั้ง", en: "Try again" })}
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-6 py-3 text-sm font-semibold text-navy-500 hover:border-magenta-500"
          >
            {t({ th: "กลับหน้าแรก", en: "Back to home" })}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
