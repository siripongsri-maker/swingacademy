import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Library,
  GitBranch,
  Package,
  Users,
  Settings,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useStaff } from "@/lib/staff-context";

const nav = [
  { to: "/staff/dashboard", label: "Dashboard", labelTh: "ภาพรวม", icon: LayoutDashboard },
  { to: "/staff/knowledge", label: "KM Library", labelTh: "คลังความรู้", icon: Library },
  { to: "/staff/transfer", label: "KT Transfer", labelTh: "ถ่ายทอดความรู้", icon: GitBranch },
  { to: "/staff/products", label: "Products", labelTh: "ผลิตภัณฑ์", icon: Package },
  { to: "/staff/talent", label: "Talent Map", labelTh: "แผนที่คน", icon: Users },
  { to: "/staff/admin", label: "Admin", labelTh: "ตั้งค่า", icon: Settings },
] as const;

export function StaffSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { openExport } = useStaff();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-navy-900 bg-navy-900 text-white transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className={`flex items-center gap-2 border-b border-white/10 px-4 py-4 ${collapsed ? "justify-center" : ""}`}>
        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-magenta-500 text-sm font-bold text-white">
          S
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">SWING Console</p>
            <p className="truncate text-[11px] text-white/50">Knowledge management</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.to || (item.to !== "/staff/dashboard" && pathname.startsWith(item.to));
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-magenta-500 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  } ${collapsed ? "justify-center" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <span className="flex flex-1 flex-col leading-tight">
                      <span>{item.label}</span>
                      <span className="text-[11px] font-normal text-white/40">{item.labelTh}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={openExport}
          className={`flex w-full items-center gap-3 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 ${
            collapsed ? "justify-center" : ""
          }`}
          title={collapsed ? "Export" : undefined}
        >
          <Download className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Export</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white ${
            collapsed ? "justify-center" : ""
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
