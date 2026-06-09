import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookMarked,
  Library,
  Users,
  GitBranch,
  CalendarClock,
  Package,
  UserCog,
  Mic,
  ArrowRight,
  AlertTriangle,
  Clock,
  Inbox,
  Plus,
  Shield,
} from "lucide-react";
import { useConsoleRole } from "@/lib/console-role-context";
import { ROLE_LABEL, type Capability } from "@/lib/permissions";
import { useStaff } from "@/lib/staff-context";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/")({
  component: StaffHome,
});

const TODAY = new Date("2026-06-07");
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

type Shortcut = {
  to: string;
  label: string;
  labelTh: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  requires?: Capability;
};

const SHORTCUTS: Shortcut[] = [
  { to: "/staff/product-knowledge", label: "บันทึกความรู้", labelTh: "Capture Knowledge", desc: "สร้างหรือบันทึกความรู้ใหม่เข้าคลัง", icon: Plus, accent: "#CC0099" },
  { to: "/staff/capture", label: "Live Capture", labelTh: "อัดเสียง / สรุปสด", desc: "บันทึกเสียงและสรุปการสนทนาแบบเรียลไทม์", icon: Mic, accent: "#7A6FC4", requires: "knowledge.capture" },
  { to: "/staff/knowledge-hub", label: "คลังความรู้", labelTh: "Knowledge Hub", desc: "เรียกดูความรู้ทั้งหมดในองค์กร", icon: LayoutDashboard, accent: "#1F8A5B" },
  { to: "/staff/knowledge", label: "Knowledge Management", labelTh: "จัดหมวด ตรวจสอบ", desc: "จัดหมวดหมู่ ตรวจสอบ และเชื่อมโยงความรู้", icon: Library, accent: "#4C4293", requires: "km.categorize" },
  { to: "/staff/talent", label: "Talent Mapping", labelTh: "เชื่อมความรู้กับคน", desc: "ดูว่าใครเป็นเจ้าของความรู้ใด", icon: Users, accent: "#C9A227", requires: "talent.viewAll" },
  { to: "/staff/knowledge-translation", label: "Knowledge Translation", labelTh: "แปลงเป็นสื่อ", desc: "แปลงความรู้เป็นเนื้อหาและสื่อการเรียน", icon: GitBranch, accent: "#0EA5E9", requires: "translation.fromOwn" },
  { to: "/staff/trainings", label: "Trainings", labelTh: "การอบรม", desc: "จัดการตารางและคอร์สอบรม", icon: CalendarClock, accent: "#F0A118" },
  { to: "/staff/transfer", label: "KT Transfer", labelTh: "ถ่ายทอดความรู้", desc: "ติดตามการถ่ายทอดความรู้ระหว่างทีม", icon: GitBranch, accent: "#7A6FC4" },
  { to: "/staff/products", label: "Products", labelTh: "ผลิตภัณฑ์", desc: "จัดการผลิตภัณฑ์ความรู้ที่เปิดให้สาธารณะ", icon: Package, accent: "#1F8A5B" },
  { to: "/staff/users", label: "Users & Roles", labelTh: "ผู้ใช้และสิทธิ์", desc: "จัดการบัญชีและสิทธิ์การเข้าถึง", icon: UserCog, accent: "#C53030", requires: "users.manage" },
];

function StaffHome() {
  const { role, can } = useConsoleRole();
  const { openAsset } = useStaff();
  const sc = seed.staffConsole as any;

  const assets = sc.knowledgeAssets as any[];
  const journeys = sc.ktJourneys as any[];
  const products = sc.products as any[];
  const certificates = sc.certificates as any[];

  const visibleShortcuts = SHORTCUTS.filter((s) => !s.requires || can(s.requires));

  const atRisk = journeys.filter((j) => {
    const apply = j.stages.find((s: any) => s.key === "apply");
    const transfer = j.stages.find((s: any) => s.key === "transfer");
    return (
      (transfer?.status !== "done" && j.stages.some((s: any) => s.key === "capture" && s.status === "done")) ||
      apply?.status === "waiting"
    );
  });

  const needsReview = assets
    .filter((a) => a.nextReview)
    .map((a) => ({ asset: a, due: new Date(a.nextReview).getTime() - TODAY.getTime() }))
    .filter(({ due }) => due < THIRTY_DAYS)
    .sort((a, b) => a.due - b.due)
    .slice(0, 5);

  const pendingTransfer = assets.filter((a) => a.source === "received" && a.status !== "published").slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Staff Console</p>
          <h1 className="mt-1 text-3xl font-semibold text-navy-500">ยินดีต้อนรับกลับมา</h1>
          <p className="mt-1 text-sm text-warm-500">เลือกเมนูลัดด้านล่าง หรือดูสถานะงานที่ต้องดำเนินการ</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-pill border border-warm-200 bg-white px-3 py-1.5 text-xs text-warm-500 shadow-sm">
          <Shield className="h-3.5 w-3.5 text-magenta-500" />
          <span className="font-semibold uppercase tracking-wider">Role</span>
          <span className="rounded bg-navy-900/5 px-2 py-0.5 font-semibold text-navy-500">{ROLE_LABEL[role].en}</span>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard accent="#CC0099" label="Knowledge assets" value={assets.length} sub={`${assets.filter((a) => a.status === "published").length} published`} />
        <StatCard accent="#7A6FC4" label="KT journeys" value={journeys.length} sub={`${atRisk.length} ต้องดูแล`} />
        <StatCard accent="#1F8A5B" label="Products" value={products.length} sub={`${products.filter((p) => p.status === "published").length} live`} />
        <StatCard accent="#C9A227" label="Certificates" value={certificates.length} sub="ออกให้ทีมและพันธมิตร" />
      </div>

      {/* Shortcuts */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-500">เมนูลัด</h2>
            <p className="text-xs text-warm-500">ทางลัดเข้าหน้าใช้งานบ่อย</p>
          </div>
          <Link to="/staff/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-magenta-500 hover:text-magenta-600">
            ดูแดชบอร์ดเต็ม <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleShortcuts.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-start gap-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-magenta-500/50 hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${s.accent}1A`, color: s.accent }}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-navy-500">{s.label}</p>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-warm-400 transition-transform group-hover:translate-x-0.5 group-hover:text-magenta-500" />
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-warm-500">{s.labelTh}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-warm-500">{s.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Task status panels */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="งานที่ต้องดูแล" subtitle="KT journeys ที่หยุดชะงัก" accent="#C53030" icon={<AlertTriangle className="h-4 w-4" />}>
          {atRisk.length === 0 ? (
            <Empty text="ทุกงานเดินหน้าตามแผน" />
          ) : (
            <ul className="divide-y divide-warm-200">
              {atRisk.slice(0, 5).map((j) => {
                const stuck = j.stages.find((s: any) => s.status === "doing" || s.status === "waiting");
                return (
                  <li key={j.id} className="px-4 py-3">
                    <p className="line-clamp-2 text-sm font-semibold text-navy-500">{j.learned}</p>
                    <p className="mt-0.5 text-xs text-warm-500">ติดที่ <span className="font-medium">{stuck?.key ?? "—"}</span></p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="ใกล้ครบกำหนดทบทวน" subtitle="ภายใน 30 วัน" accent="#F0A118" icon={<Clock className="h-4 w-4" />}>
          {needsReview.length === 0 ? (
            <Empty text="ยังไม่มีรายการที่ต้องทบทวน" />
          ) : (
            <ul className="divide-y divide-warm-200">
              {needsReview.map(({ asset, due }) => {
                const overdue = due < 0;
                return (
                  <li key={asset.id}>
                    <button onClick={() => openAsset(asset.id)} className="flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-warm-50">
                      <p className="line-clamp-2 text-sm font-semibold text-navy-500">{asset.title}</p>
                      <p className={`mt-0.5 text-xs ${overdue ? "font-semibold text-danger" : "text-warm-500"}`}>
                        {overdue ? "เลยกำหนด · " : "ครบกำหนด "}
                        {fmt(asset.nextReview)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="รอถ่ายทอด" subtitle="ความรู้ที่รับมาแต่ยังไม่ได้แชร์" accent="#7A6FC4" icon={<Inbox className="h-4 w-4" />}>
          {pendingTransfer.length === 0 ? (
            <Empty text="กล่องขาเข้าว่างแล้ว" />
          ) : (
            <ul className="divide-y divide-warm-200">
              {pendingTransfer.map((a) => (
                <li key={a.id}>
                  <button onClick={() => openAsset(a.id)} className="flex w-full flex-col items-start px-4 py-3 text-left transition-colors hover:bg-warm-50">
                    <p className="line-clamp-2 text-sm font-semibold text-navy-500">{a.title}</p>
                    <p className="mt-0.5 text-xs text-warm-500">รอจัดการ</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatCard({ accent, label, value, sub }: { accent: string; label: string; value: number; sub: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      <div className="h-1 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-navy-500">{value}</p>
        <p className="mt-1 text-xs text-warm-500">{sub}</p>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, accent, icon }: { title: string; subtitle: string; children: React.ReactNode; accent?: string; icon?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-warm-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-warm-200 px-5 py-4">
        {icon && (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: accent ? `${accent}1A` : "#EFECF9", color: accent ?? "#4C4293" }}>
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-navy-500">{title}</h3>
          <p className="mt-0.5 text-xs text-warm-500">{subtitle}</p>
        </div>
      </header>
      <div className="max-h-96 overflow-y-auto">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-warm-500">{text}</p>;
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
