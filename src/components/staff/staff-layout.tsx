import type { ReactNode } from "react";
import { StaffSidebar } from "./staff-sidebar";
import { StaffTopbar } from "./staff-topbar";
import { StaffDrawerHost } from "./staff-drawer-host";

export function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-warm-50 text-navy-500">
      <StaffSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
      <StaffDrawerHost />
    </div>
  );
}
