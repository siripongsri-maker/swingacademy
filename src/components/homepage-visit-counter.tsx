import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Eye, Users, Sparkles } from "lucide-react";
import { trackSiteVisit, getHomepageStats } from "@/lib/knowledge-analytics.functions";

function visitorHash(): string {
  if (typeof window === "undefined") return "";
  const KEY = "swing.visitorHash";
  let h = localStorage.getItem(KEY);
  if (!h) {
    h = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(KEY, h);
  }
  return h;
}

export function HomepageVisitCounter() {
  const track = useServerFn(trackSiteVisit);
  const fetchStats = useServerFn(getHomepageStats);

  useEffect(() => {
    const sessionKey = "swing.homeVisited";
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    track({
      data: {
        path: "/",
        visitorHash: visitorHash(),
        userAgent: navigator.userAgent.slice(0, 500),
      },
    }).catch(() => {});
  }, [track]);

  const q = useQuery({
    queryKey: ["site-visits", "/"],
    queryFn: () => fetchStats(),
    staleTime: 60_000,
  });
  const s = q.data?.stats;

  return (
    <div className="mt-8 inline-flex flex-wrap items-center gap-3 rounded-pill border border-warm-200 bg-white/80 px-4 py-2 text-xs text-warm-600 shadow-sm backdrop-blur">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-magenta-500" /> ผู้เข้าถึงคลังความรู้
      </span>
      <span className="inline-flex items-center gap-1 font-semibold text-navy-500">
        <Eye className="h-3.5 w-3.5" /> {s?.total ?? 0} ครั้ง
      </span>
      <span className="inline-flex items-center gap-1 font-semibold text-navy-500">
        <Users className="h-3.5 w-3.5" /> {s?.unique ?? 0} คน
      </span>
      <span className="text-warm-500">วันนี้ {s?.today ?? 0}</span>
    </div>
  );
}
