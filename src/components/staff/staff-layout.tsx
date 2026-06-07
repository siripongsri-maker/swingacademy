import { useEffect, useState, type ReactNode } from "react";
import { StaffSidebar } from "./staff-sidebar";
import { StaffTopbar } from "./staff-topbar";
import { StaffDrawerHost } from "./staff-drawer-host";
import { useRouterState } from "@tanstack/react-router";

export function StaffLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock scroll while mobile sidebar is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh w-full bg-warm-50 text-navy-500">
      <StaffSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar onMobileMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
      <StaffDrawerHost />
    </div>
  );
}
