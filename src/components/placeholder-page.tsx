import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/public-layout";
import { useLanguage, type Localized } from "@/lib/language-context";
import { Construction } from "lucide-react";

type Props = { eyebrow: Localized; title: Localized; body: Localized };

export function PlaceholderPage({ eyebrow, title, body }: Props) {
  const { t, lang } = useLanguage();
  return (
    <PublicLayout>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-md bg-lavender-100 text-lavender-700">
          <Construction className="h-6 w-6" />
        </div>
        <p className="eyebrow mb-3">{t(eyebrow)}</p>
        <h1 lang={lang} className="text-4xl font-semibold text-navy-500">
          {t(title)}
        </h1>
        <p lang={lang} className="mt-4 text-lg text-warm-500">
          {t(body)}
        </p>
      </section>
    </PublicLayout>
  );
}

export { createFileRoute };
