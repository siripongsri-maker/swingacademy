import { Construction } from "lucide-react";

export function StaffStub({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-md bg-lavender-100 text-lavender-900">
        <Construction className="h-6 w-6" />
      </div>
      <h1 className="text-3xl font-semibold text-navy-500">{title}</h1>
      <p className="mt-2 text-sm text-warm-500">{subtitle}</p>
    </div>
  );
}
