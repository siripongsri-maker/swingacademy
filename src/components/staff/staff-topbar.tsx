import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Search, ChevronRight } from "lucide-react";

const crumbMap: Record<string, string> = {
  "/staff": "Staff",
  "/staff/dashboard": "Dashboard",
  "/staff/knowledge": "KM Library",
  "/staff/transfer": "KT Transfer",
  "/staff/products": "Products",
  "/staff/talent": "Talent Map",
  "/staff/admin": "Admin",
};

export function StaffTopbar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const segments = pathname.split("/").filter(Boolean);

  const crumbs: { label: string; href: string }[] = [];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ label: crumbMap[acc] ?? seg, href: acc });
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-warm-200 bg-white px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-warm-400" />}
              {last ? (
                <span className="truncate font-semibold text-navy-500">{c.label}</span>
              ) : (
                <Link
                  to={c.href as "/staff/dashboard"}
                  className="truncate text-warm-500 hover:text-navy-500"
                >
                  {c.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            type="search"
            placeholder="Search assets, products, people..."
            className="w-72 rounded-pill border border-warm-200 bg-warm-50 py-2 pl-9 pr-3 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:outline-none focus:ring-2 focus:ring-magenta-500/20"
          />
        </div>

        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-pill text-warm-500 transition-colors hover:bg-warm-100 hover:text-navy-500"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-pill bg-magenta-500" />
        </button>

        <div className="flex items-center gap-2 border-l border-warm-200 pl-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-lavender-300 text-sm font-semibold text-navy-500">
            ม
          </span>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-xs font-semibold text-navy-500">มะปราง</p>
            <p className="text-[11px] text-warm-500">M&E Lead</p>
          </div>
        </div>
      </div>
    </header>
  );
}
