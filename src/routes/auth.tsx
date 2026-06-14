import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, ShieldCheck, Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage } from "@/lib/language-context";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SWING Academy" },
      { name: "description", content: "Sign in to SWING Academy as a learner or staff member." },
      { property: "og:title", content: "Sign in — SWING Academy" },
      { property: "og:description", content: "Sign in to SWING Academy as a learner or staff." },
    ],
  }),
  component: AuthPage,
});

type Tab = "learner" | "staff";
type Mode = "signin" | "signup";

function AuthPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("learner");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isStaff = tab === "staff";

  const routeAfterSignIn = async () => {
    // Check role; staff/admin → staff dashboard, otherwise learner dashboard.
    const { data: roles } = await supabase.from("user_roles").select("role");
    const r = (roles ?? []).map((x) => x.role as string);
    const staffish =
      r.includes("staff") ||
      r.includes("trainer") ||
      r.includes("admin") ||
      r.includes("superadmin");
    if (isStaff && !staffish) {
      setErr(
        t({
          th: "บัญชีนี้ยังไม่มีสิทธิ์เจ้าหน้าที่ ติดต่อแอดมินเพื่อขอสิทธิ์",
          en: "This account doesn't have staff access yet. Contact an admin to be granted access.",
        }),
      );
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }
    navigate({ to: staffish ? "/staff" : "/dashboard" });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setErr(
          t({
            th: "ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย",
            en: "Confirmation email sent. Check your inbox to finish signing up.",
          }),
        );
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await routeAfterSignIn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErr(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      setErr(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return; // browser leaves
    await routeAfterSignIn();
  };

  return (
    <PublicLayout>
      <section className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
        <h1 lang={lang} className="text-3xl font-semibold text-navy-500">
          {t({ th: "เข้าสู่ระบบ", en: "Welcome back" })}
        </h1>
        <p lang={lang} className="mt-2 text-center text-sm text-warm-500">
          {t({
            th: "เลือกประเภทบัญชีที่ตรงกับคุณ — เรียนรู้หรือทำงานกับ SWING",
            en: "Pick the account type that matches you — learn with us, or work with us.",
          })}
        </p>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Account type"
          className="mt-7 inline-flex rounded-pill border border-warm-200 bg-white p-1 shadow-sm"
        >
          <TabButton active={tab === "learner"} onClick={() => { setTab("learner"); setErr(null); }}>
            <GraduationCap className="h-4 w-4" />
            {t({ th: "ผู้เรียน", en: "Learner" })}
          </TabButton>
          <TabButton active={tab === "staff"} onClick={() => { setTab("staff"); setErr(null); }}>
            <ShieldCheck className="h-4 w-4" />
            {t({ th: "เจ้าหน้าที่", en: "Staff" })}
          </TabButton>
        </div>

        <div className="mt-6 w-full rounded-lg border border-warm-200 bg-white p-6 shadow-sm">
          <p lang={lang} className="text-sm text-warm-700">
            {isStaff
              ? t({
                  th: "เฉพาะเจ้าหน้าที่ที่ได้รับอนุมัติเท่านั้น ใช้อีเมลที่แอดมินมอบให้",
                  en: "Staff access only. Use the email your admin invited you with.",
                })
              : t({
                  th: "บัญชีฟรี เรียนได้ทุกคอร์ส ความคืบหน้าและใบประกาศจะถูกบันทึกไว้",
                  en: "Free account. Save your progress and earn certificates across all courses.",
                })}
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-pill border border-warm-300 bg-white px-4 py-2.5 text-sm font-semibold text-navy-500 shadow-sm transition-all hover:border-magenta-500 disabled:opacity-60"
          >
            <GoogleIcon />
            {t({ th: "ดำเนินการต่อด้วย Google", en: "Continue with Google" })}
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-warm-400">
            <div className="h-px flex-1 bg-warm-200" />
            {t({ th: "หรือ", en: "or" })}
            <div className="h-px flex-1 bg-warm-200" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-warm-500">
                {t({ th: "อีเมล", en: "Email" })}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-md border border-warm-200 bg-cream py-2.5 pl-10 pr-3 text-sm text-navy-500 outline-none focus:border-magenta-500 focus:bg-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-warm-500">
                {t({ th: "รหัสผ่าน", en: "Password" })}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-md border border-warm-200 bg-cream py-2.5 pl-10 pr-3 text-sm text-navy-500 outline-none focus:border-magenta-500 focus:bg-white"
                />
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-pill bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-magenta-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup"
                ? t({ th: "สร้างบัญชี", en: "Create account" })
                : t({ th: "เข้าสู่ระบบ", en: "Sign in" })}
            </button>

            {!isStaff && (
              <button
                type="button"
                onClick={() => { setMode((m) => (m === "signin" ? "signup" : "signin")); setErr(null); }}
                className="block w-full text-center text-xs text-warm-500 underline-offset-2 hover:text-magenta-500 hover:underline"
              >
                {mode === "signin"
                  ? t({ th: "ยังไม่มีบัญชี? สมัครเลย", en: "No account yet? Sign up" })
                  : t({ th: "มีบัญชีแล้ว? เข้าสู่ระบบ", en: "Have an account? Sign in" })}
              </button>
            )}
          </form>
        </div>

        <Link
          to="/"
          className="mt-5 text-xs text-warm-500 hover:text-magenta-500"
        >
          {t({ th: "← กลับหน้าแรก", en: "← Back to home" })}
        </Link>
      </section>
    </PublicLayout>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? "bg-magenta-500 text-white shadow-sm"
          : "text-navy-500/70 hover:text-magenta-500"
      }`}
    >
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c3 0 5.7 1.1 7.7 2.9l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.7 2.9l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5l-6-5.1c-2 1.4-4.4 2.1-6.9 2.1-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.7 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6 5.1C40.7 35.6 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
