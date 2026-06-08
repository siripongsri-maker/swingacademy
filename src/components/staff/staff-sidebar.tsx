import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookMarked,
  Library,
  Users,
  GitBranch,
  CalendarClock,
  Package,
  UserCog,
  Settings,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Mic,
  Shield,
} from "lucide-react";
import { useStaff } from "@/lib/staff-context";
import { useConsoleRole } from "@/lib/console-role-context";
import { ROLE_LABEL, type Capability } from "@/lib/permissions";
import logoAsset from "@/assets/swing-academy-logo.png.asset.json";

type NavItem = {
  to: string;
  label: string;
  labelTh: string;
  icon: React.ComponentType<{ className?: string }>;
};

const knowledgeFlow: NavItem[] = [
  { to: "/staff/capture", label: "Live Capture", labelTh: "อัดเสียง / สรุปสด", icon: Mic },
  { to: "/staff/product-knowledge", label: "Knowledge Product", labelTh: "บันทึก/สร้างความรู้", icon: BookMarked },
  { to: "/staff/knowledge", label: "Knowledge Management", labelTh: "จัดหมวด ตรวจสอบ เชื่อมโยง", icon: Library },
  { to: "/staff/talent", label: "Talent Mapping", labelTh: "เชื่อมความรู้กับคน", icon: Users },
  { to: "/staff/knowledge-translation", label: "Knowledge Translation", labelTh: "แปลงเป็นสื่อ/เนื้อหา", icon: GitBranch },
];

const consoleNav: NavItem[] = [
  { to: "/staff/dashboard", label: "Dashboard", labelTh: "ภาพรวม", icon: LayoutDashboard },
  { to: "/staff/trainings", label: "Trainings", labelTh: "การอบรม", icon: CalendarClock },
  { to: "/staff/transfer", label: "KT Transfer", labelTh: "ถ่ายทอดความรู้", icon: GitBranch },
  { to: "/staff/products", label: "Products", labelTh: "ผลิตภัณฑ์", icon: Package },
  { to: "/staff/users", label: "Users & Roles", labelTh: "ผู้ใช้และสิทธิ์", icon: UserCog },
  { to: "/staff/admin", label: "Admin", labelTh: "ตั้งค่า", icon: Settings },
];

type Props = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function StaffSidebar({ mobileOpen = false, onMobileClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { openExport } = useStaff();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const active =
      pathname === item.to ||
      (item.to !== "/staff/dashboard" && pathname.startsWith(item.to));
    return (
      <li key={item.to}>
        <Link
          to={item.to}
          className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            active
              ? "bg-magenta-500 text-white"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          } ${collapsed ? "lg:justify-center" : ""}`}
          title={collapsed ? item.label : undefined}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className={`flex flex-1 flex-col leading-tight ${collapsed ? "lg:hidden" : ""}`}>
            <span>{item.label}</span>
            <span lang="th" className="text-[11px] font-normal text-white/70">
              {item.labelTh}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-navy-900/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        aria-label="Staff navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-navy-900 bg-navy-900 text-white transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 lg:transition-[width] ${
          collapsed ? "lg:w-16" : "lg:w-64"
        } ${mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"} lg:!translate-x-0`}
      >
        <div
          className={`flex items-center gap-2 border-b border-white/10 px-4 py-4 ${
            collapsed ? "lg:justify-center" : ""
          }`}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm ring-1 ring-white/10">
            <img src={logoAsset.url} alt="SWING Academy" className="h-full w-full object-contain" />
          </span>
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="truncate text-sm font-semibold leading-tight">SWING Console</p>
            <p className="truncate text-[11px] text-white/50">Knowledge platform</p>
          </div>
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              aria-label="Close menu"
              className="ml-auto rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Primary CTA — single entry point */}
        <div className="px-3 pt-3">
          <Link
            to="/staff/product-knowledge"
            search={{ create: 1 }}
            onClick={onMobileClose}
            className={`flex w-full items-center gap-2 rounded-md bg-magenta-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-magenta-600 ${
              collapsed ? "lg:justify-center lg:px-2" : ""
            }`}
            title={collapsed ? "Capture Knowledge" : undefined}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            <span className={`flex flex-1 flex-col text-left leading-tight ${collapsed ? "lg:hidden" : ""}`}>
              <span>Capture Knowledge</span>
              <span lang="th" className="text-[11px] font-normal text-white/80">
                บันทึกความรู้
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3" aria-label="Primary">
          <div className={`px-4 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40 ${collapsed ? "lg:hidden" : ""}`}>
            Knowledge Workflow
          </div>
          <ul className="space-y-0.5 px-2">{knowledgeFlow.map(renderItem)}</ul>

          <div className={`mt-4 px-4 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/40 ${collapsed ? "lg:hidden" : ""}`}>
            Console
          </div>
          <ul className="space-y-0.5 px-2">{consoleNav.map(renderItem)}</ul>
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            onClick={openExport}
            className={`flex w-full items-center gap-3 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 ${
              collapsed ? "lg:justify-center" : ""
            }`}
            title={collapsed ? "Export" : undefined}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            <span className={collapsed ? "lg:hidden" : ""}>Export</span>
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`mt-2 hidden w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:flex ${
              collapsed ? "justify-center" : ""
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
