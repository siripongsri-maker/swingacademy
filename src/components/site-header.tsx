import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Languages, Menu, X, LogOut, HelpCircle, ShieldCheck, ChevronDown } from "lucide-react";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import { BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnboardingTour, hasSeenTour } from "@/components/onboarding-tour";
import { supabase } from "@/integrations/supabase/client";

type SupaUser = { id: string; email: string; name: string; initial: string };

function useSupabaseAccount() {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      if (!u) {
        setUser(null);
        setIsStaff(false);
        return;
      }
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        (u.email ? u.email.split("@")[0] : "Account");
      const initial = (name.trim().charAt(0) || "?").toUpperCase();
      setUser({ id: u.id, email: u.email ?? "", name, initial });
      const { data: roles } = await supabase.from("user_roles").select("role");
      if (cancelled) return;
      const r = (roles ?? []).map((x) => x.role as string);
      setIsStaff(
        r.includes("staff") ||
          r.includes("trainer") ||
          r.includes("admin") ||
          r.includes("superadmin"),
      );
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isStaff };
}

const NAV: { to: string; label: Localized }[] = [
  { to: "/", label: { th: "หน้าแรก", en: "Home" } },
  { to: "/classroom", label: { th: "ห้องเรียน", en: "Classroom" } },
  { to: "/my/notes", label: { th: "โน้ตของฉัน", en: "My Notes" } },
  { to: "/my/voice", label: { th: "เสียงของฉัน", en: "My Voice" } },
  { to: "/resources", label: { th: "คลังความรู้", en: "Resources" } },
  { to: "/verify", label: { th: "ตรวจสอบใบประกาศ", en: "Verify" } },
];

export function SiteHeader() {
  const { lang, toggle, t } = useLanguage();
  const { signedIn, learner, signOut } = useAccount();
  const { user: supaUser, isStaff } = useSupabaseAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const handleSupaSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !hasSeenTour("learner")) {
      const id = setTimeout(() => setTourOpen(true), 1200);
      return () => clearTimeout(id);
    }
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-warm-200 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="SWING Academy หน้าแรก"
            onClick={() => setOpen(false)}
          >
            <BrandLogo imgClassName="h-8 w-8 md:h-10 md:w-10" />
          </Link>

          <nav aria-label="เมนูหลัก" className="hidden items-center gap-1 xl:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="whitespace-nowrap rounded-pill px-3 py-2 text-sm font-medium text-navy-500/80 transition-colors hover:bg-white hover:text-magenta-500"
                activeProps={{ className: "bg-white text-magenta-500 shadow-sm" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
              className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-warm-300 bg-white px-3 text-sm font-medium text-navy-500 transition-all hover:border-magenta-500 hover:text-magenta-500"
            >
              <Languages className="hidden h-4 w-4 sm:block" aria-hidden />
              <span className={lang === "th" ? "text-magenta-500" : ""}>ไทย</span>
              <span className="text-warm-300">/</span>
              <span className={lang === "en" ? "text-magenta-500" : ""}>EN</span>
            </button>

            {supaUser ? (
              <div className="hidden items-center gap-2 md:flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-2 rounded-pill border border-warm-300 bg-white px-3 py-1.5 text-sm font-medium text-navy-500 transition-all hover:border-magenta-500 hover:text-magenta-500">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-lavender-300 text-navy-500 font-semibold text-xs">
                        {supaUser.initial}
                      </span>
                      <span className="hidden text-sm font-medium lg:inline">{supaUser.name}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[10rem]">
                    <DropdownMenuLabel>{supaUser.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isStaff && (
                      <DropdownMenuItem asChild>
                        <Link to="/staff" className="cursor-pointer gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          {t({ th: "เข้าหลังบ้าน", en: "Staff console" })}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleSupaSignOut} className="cursor-pointer gap-2">
                      <LogOut className="h-4 w-4" />
                      {t({ th: "ออกจากระบบ", en: "Sign out" })}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : signedIn ? (
              <div className="hidden items-center gap-2 md:flex">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-lavender-300 text-navy-500 font-semibold">
                  {learner.initial}
                </span>
                <span lang={lang} className="text-sm font-medium text-navy-500">
                  {t(learner.name)}
                </span>
                <button
                  onClick={signOut}
                  aria-label="Sign out"
                  className="rounded-pill p-1.5 text-warm-500 transition-colors hover:bg-warm-100 hover:text-navy-500"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="hidden h-10 items-center whitespace-nowrap rounded-pill bg-magenta-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-magenta-700 md:inline-flex"
              >
                {t({ th: "เข้าสู่ระบบ", en: "Sign in" })}
              </Link>
            )}

            <button
              type="button"
              onClick={() => setTourOpen(true)}
              aria-label={t({ th: "แนะนำการใช้งาน", en: "Help / tour" })}
              className="hidden h-10 w-10 items-center justify-center rounded-pill border border-warm-300 bg-white text-navy-500 transition-colors hover:border-magenta-500 hover:text-magenta-500 md:inline-flex"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={t({ th: "เมนู", en: "Menu" })}
              aria-expanded={open}
              className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-warm-300 bg-white text-navy-500 xl:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-warm-200 bg-cream xl:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-navy-500/80 hover:bg-white hover:text-magenta-500"
                  activeProps={{ className: "bg-white text-magenta-500" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {t(item.label)}
                </Link>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-warm-200 pt-3">
                {supaUser ? (
                  <>
                    {isStaff && (
                      <Link
                        to="/staff"
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-navy-500 px-4 py-2 text-sm font-semibold text-white"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {t({ th: "เข้าหลังบ้าน", en: "Staff console" })}
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setOpen(false);
                        void handleSupaSignOut();
                      }}
                      className="w-full rounded-pill border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-navy-500"
                    >
                      {t({ th: "ออกจากระบบ", en: "Sign out" })} ({supaUser.name})
                    </button>
                  </>
                ) : signedIn ? (
                  <button
                    onClick={() => {
                      signOut();
                      setOpen(false);
                    }}
                    className="w-full rounded-pill border border-warm-300 bg-white px-4 py-2 text-sm font-semibold text-navy-500"
                  >
                    {t({ th: "ออกจากระบบ", en: "Sign out" })} ({t(learner.name)})
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="block w-full rounded-pill bg-magenta-500 px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    {t({ th: "เข้าสู่ระบบ", en: "Sign in" })}
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} variant="learner" />
    </>
  );
}
