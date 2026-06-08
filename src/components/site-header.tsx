import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Languages, Menu, X, LogOut } from "lucide-react";
import { useLanguage, type Localized } from "@/lib/language-context";
import { useAccount } from "@/lib/account-context";
import { SignInModal } from "@/components/sign-in-modal";
import { BrandLogo } from "@/components/brand-logo";

const NAV: { to: string; label: Localized }[] = [
  { to: "/", label: { th: "หน้าแรก", en: "Home" } },
  { to: "/courses", label: { th: "คอร์ส", en: "Courses" } },
  { to: "/paths", label: { th: "เส้นทางเรียนรู้", en: "Paths" } },
  { to: "/resources", label: { th: "คลังความรู้", en: "Resources" } },
  { to: "/verify", label: { th: "ตรวจสอบใบประกาศ", en: "Verify" } },
];

export function SiteHeader() {
  const { lang, toggle, t } = useLanguage();
  const { signedIn, learner, signOut } = useAccount();
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-warm-200 bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link
            to="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
            aria-label="SWING Academy — Home"
            onClick={() => setOpen(false)}
          >
            <BrandLogo size={400} />
          </Link>


          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-navy-500/80 transition-colors hover:text-magenta-500"
                activeProps={{ className: "text-magenta-500" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle language"
              className="inline-flex items-center gap-1.5 rounded-pill border border-warm-300 bg-white px-3 py-1.5 text-sm font-medium text-navy-500 transition-all hover:border-magenta-500 hover:text-magenta-500"
            >
              <Languages className="h-4 w-4" />
              <span className={lang === "th" ? "text-magenta-500" : ""}>ไทย</span>
              <span className="text-warm-300">/</span>
              <span className={lang === "en" ? "text-magenta-500" : ""}>EN</span>
            </button>

            {signedIn ? (
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
              <button
                onClick={() => setSignInOpen(true)}
                className="hidden rounded-pill bg-magenta-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-magenta-700 md:inline-flex"
              >
                {t({ th: "เข้าสู่ระบบ", en: "Sign in" })}
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              className="inline-flex items-center justify-center rounded-pill border border-warm-300 bg-white p-2 text-navy-500 lg:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-warm-200 bg-cream lg:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-navy-500/80 hover:bg-white hover:text-magenta-500"
                  activeProps={{ className: "bg-white text-magenta-500" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {t(item.label)}
                </Link>
              ))}
              <div className="mt-2 border-t border-warm-200 pt-3">
                {signedIn ? (
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
                  <button
                    onClick={() => {
                      setSignInOpen(true);
                      setOpen(false);
                    }}
                    className="w-full rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    {t({ th: "เข้าสู่ระบบ", en: "Sign in" })}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
