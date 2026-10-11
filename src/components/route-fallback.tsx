import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage } from "@/lib/language-context";

/** Friendly, bilingual error state for public routes. The technical message goes to the console only. */
export function RouteError({ error }: { error: Error }) {
  const { t, lang } = useLanguage();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p lang={lang} className="text-lg font-semibold text-navy-500">
          {t({ th: "เปิดหน้านี้ไม่ได้ตอนนี้", en: "This page didn't load" })}
        </p>
        <p lang={lang} className="mt-2 text-warm-600">
          {t({
            th: "กดรีเฟรชอีกครั้ง หรือกลับไปหน้าแรก",
            en: "Refresh the page, or go back home.",
          })}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-pill bg-navy-500 px-5 text-sm font-semibold text-white hover:bg-navy-700"
        >
          {t({ th: "กลับหน้าแรก", en: "Go home" })}
        </Link>
      </div>
    </PublicLayout>
  );
}

export function RouteNotFound() {
  const { t, lang } = useLanguage();
  return (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <p lang={lang} className="text-lg font-semibold text-navy-500">
          {t({ th: "ไม่เจอหน้านี้", en: "Page not found" })}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center rounded-pill bg-navy-500 px-5 text-sm font-semibold text-white hover:bg-navy-700"
        >
          {t({ th: "กลับหน้าแรก", en: "Go home" })}
        </Link>
      </div>
    </PublicLayout>
  );
}
