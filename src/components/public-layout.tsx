import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function PublicLayout({
  children,
  flushFooter = false,
}: {
  children: ReactNode;
  /** Drop the gap above the footer, for pages that end on a full-bleed band. */
  flushFooter?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter flush={flushFooter} />
    </div>
  );
}
