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
  HardDrive,
  GraduationCap,
  StickyNote,
  Volume2,
  FlaskConical,
} from "lucide-react";
import { useStaff } from "@/lib/staff-context";
import { useConsoleRole } from "@/lib/console-role-context";
import { ROLE_LABEL, type Capability } from "@/lib/permissions";
import { useLanguage, type Localized } from "@/lib/language-context";
import logoAsset from "@/assets/swing-academy-logo.png.asset.json";

type NavItem = {
  to: string;
  label: Localized;
  sub: Localized;
  icon: React.ComponentType<{ className?: string }>;
  requires?: Capability;
};

const knowledgeFlow: NavItem[] = [
  { to: "/staff/knowledge-hub", label: { th: "คลังความรู้", en: "Knowledge Hub" }, sub: { th: "ภาพรวมคลังความรู้", en: "Browse library" }, icon: LayoutDashboard },
  { to: "/staff/capture", label: { th: "อัดเสียง / สรุปสด", en: "Live Capture" }, sub: { th: "บันทึกสนทนาแบบเรียลไทม์", en: "Record live notes" }, icon: Mic, requires: "knowledge.capture" },
  { to: "/staff/product-knowledge", label: { th: "บันทึก/สร้างความรู้", en: "Knowledge Product" }, sub: { th: "สร้างความรู้ใหม่", en: "Author knowledge" }, icon: BookMarked },
  { to: "/staff/knowledge", label: { th: "จัดการความรู้", en: "Knowledge Management" }, sub: { th: "จัดหมวด ตรวจสอบ เชื่อมโยง", en: "Categorize & review" }, icon: Library, requires: "km.categorize" },
  { to: "/staff/knowledge-library", label: { th: "คลังความรู้ (DB)", en: "Knowledge Library" }, sub: { th: "เผยแพร่/ซ่อน · แก้ไขในฐานข้อมูล", en: "Publish/hide · edit in DB" }, icon: Library, requires: "km.categorize" },
  { to: "/staff/talent", label: { th: "เชื่อมความรู้กับคน", en: "Talent Mapping" }, sub: { th: "ผู้เชี่ยวชาญในองค์กร", en: "Experts directory" }, icon: Users, requires: "talent.viewAll" },
  { to: "/staff/knowledge-translation", label: { th: "แปลงเป็นสื่อ", en: "Knowledge Translation" }, sub: { th: "แปลงเป็นเนื้อหา/สื่อ", en: "Turn into content" }, icon: GitBranch, requires: "translation.fromOwn" },
];

// Research instrument (CVSK). Admin-only in the menu; RLS also admits research roles.
const researchNav: NavItem[] = [
  { to: "/staff/research/baseline", label: { th: "Baseline (รอบ 0)", en: "Baseline (Round 0)" }, sub: { th: "ความรู้ที่มีอยู่แล้ว", en: "What already exists" }, icon: FlaskConical, requires: "roles.manage" },
];

const consoleNav: NavItem[] = [
  { to: "/staff/dashboard", label: { th: "แดชบอร์ด", en: "Dashboard" }, sub: { th: "ภาพรวม", en: "Overview" }, icon: LayoutDashboard },
  { to: "/classroom", label: { th: "ห้องเรียน", en: "Classrooms" }, sub: { th: "จัดการห้องเรียนและบทเรียน", en: "Manage classrooms" }, icon: GraduationCap },
  { to: "/staff/notes", label: { th: "โน้ตทั้งหมด", en: "All Notes" }, sub: { th: "โน้ตจากผู้เรียน", en: "Learner notes" }, icon: StickyNote, requires: "users.manage" },
  { to: "/staff/voice", label: { th: "เสียงบันทึก", en: "Voice Records" }, sub: { th: "เสียงจากผู้เรียน", en: "Learner voices" }, icon: Volume2, requires: "users.manage" },
  { to: "/staff/trainings", label: { th: "การอบรม", en: "Trainings" }, sub: { th: "ตารางและคอร์ส", en: "Schedule & courses" }, icon: CalendarClock },
  { to: "/staff/transfer", label: { th: "ถ่ายทอดความรู้", en: "KT Transfer" }, sub: { th: "ติดตามการถ่ายทอด", en: "Track transfers" }, icon: GitBranch },
  { to: "/staff/storage", label: { th: "ไฟล์ใน Storage", en: "Storage Files" }, sub: { th: "ตรวจสอบไฟล์ที่อัปโหลด", en: "Inspect uploaded files" }, icon: HardDrive, requires: "users.manage" },
  { to: "/staff/users", label: { th: "ผู้ใช้และสิทธิ์", en: "Users & Roles" }, sub: { th: "จัดการบัญชี", en: "Manage accounts" }, icon: UserCog, requires: "users.manage" },
  { to: "/staff/admin", label: { th: "ตั้งค่า", en: "Admin" }, sub: { th: "ตั้งค่าระบบ", en: "System settings" }, icon: Settings, requires: "roles.manage" },
];

type Props = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function StaffSidebar({ mobileOpen = false, onMobileClose }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { openExport } = useStaff();
  const { role, can } = useConsoleRole();
  const { t, lang } = useLanguage();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const visible = (items: NavItem[]) => items.filter((i) => !i.requires || can(i.requires));

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
          title={collapsed ? t(item.label) : undefined}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className={`flex flex-1 flex-col leading-tight ${collapsed ? "lg:hidden" : ""}`}>
            <span lang={lang}>{t(item.label)}</span>
            <span className="text-[11px] font-normal text-white/70">
              {t(item.sub)}
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
            <p className="truncate text-[11px] text-white/50">{t({ th: "แพลตฟอร์มความรู้", en: "Knowledge platform" })}</p>
          </div>
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              aria-label={t({ th: "ปิดเมนู", en: "Close menu" })}
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
            title={collapsed ? t({ th: "บันทึกความรู้", en: "Capture Knowledge" }) : undefined}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            <span className={`flex flex-1 flex-col text-left leading-tight ${collapsed ? "lg:hidden" : ""}`}>
              <span lang={lang}>{t({ th: "บันทึกความรู้", en: "Capture Knowledge" })}</span>
              <span className="text-[11px] font-normal text-white/80">
                {t({ th: "เริ่มสร้างความรู้ใหม่", en: "Start a new entry" })}
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-3" aria-label="Primary">
          <div className={`px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/60 ${collapsed ? "lg:hidden" : ""}`}>
            {t({ th: "กระบวนการความรู้", en: "Knowledge Workflow" })}
          </div>
          <ul className="space-y-0.5 px-2">{visible(knowledgeFlow).map(renderItem)}</ul>

          <div className={`mt-4 px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/60 ${collapsed ? "lg:hidden" : ""}`}>
            {t({ th: "คอนโซล", en: "Console" })}
          </div>
          <ul className="space-y-0.5 px-2">{visible(consoleNav).map(renderItem)}</ul>

          {visible(researchNav).length > 0 && (
            <>
              <div className={`mt-4 px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/60 ${collapsed ? "lg:hidden" : ""}`}>
                {t({ th: "งานวิจัย", en: "Research" })}
              </div>
              <ul className="space-y-0.5 px-2">{visible(researchNav).map(renderItem)}</ul>
            </>
          )}
        </nav>

        <div className={`border-t border-white/10 p-3 ${collapsed ? "lg:hidden" : ""}`}>
          <div className="flex items-center gap-1.5 text-[11px] text-white/60">
            <Shield className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wider text-white/40">{t({ th: "สิทธิ์", en: "Role" })}</span>
            <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
              {lang === "th" ? ROLE_LABEL[role].th : ROLE_LABEL[role].en}
            </span>
          </div>
        </div>

        <div className="border-t border-white/10 p-2">
          <button
            onClick={openExport}
            className={`flex w-full items-center gap-3 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 ${
              collapsed ? "lg:justify-center" : ""
            }`}
            title={collapsed ? t({ th: "ส่งออก", en: "Export" }) : undefined}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            <span className={collapsed ? "lg:hidden" : ""}>{t({ th: "ส่งออก", en: "Export" })}</span>
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`mt-2 hidden w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:flex ${
              collapsed ? "justify-center" : ""
            }`}
            aria-label={collapsed ? t({ th: "ขยายเมนู", en: "Expand sidebar" }) : t({ th: "ย่อเมนู", en: "Collapse sidebar" })}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>{t({ th: "ย่อเมนู", en: "Collapse" })}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
