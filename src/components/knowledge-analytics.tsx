import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Star, Users, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  trackKnowledgeView,
  getKnowledgeStats,
  submitKnowledgeRating,
} from "@/lib/knowledge-analytics.functions";

// Stable anonymous identifier kept in localStorage, used only to deduplicate
// view counts and to allow a single rating per browser.
function getOrCreateVisitorHash(): string {
  if (typeof window === "undefined") return "";
  const KEY = "swing.visitorHash";
  let h = localStorage.getItem(KEY);
  if (!h) {
    h = `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(KEY, h);
  }
  return h;
}

export function KnowledgeAnalytics({
  slug,
  knowledgeId,
}: {
  slug: string;
  knowledgeId: string | null;
}) {
  const qc = useQueryClient();
  const track = useServerFn(trackKnowledgeView);
  const fetchStats = useServerFn(getKnowledgeStats);
  const rate = useServerFn(submitKnowledgeRating);

  const [hash, setHash] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const h = getOrCreateVisitorHash();
    setHash(h);
    // Track view once per slug per session
    const sessionKey = `swing.viewed.${slug}`;
    if (!sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "1");
      track({
        data: {
          slug,
          knowledgeId: knowledgeId ?? undefined,
          viewerHash: h,
          userAgent: navigator.userAgent.slice(0, 500),
        },
      }).then(() => qc.invalidateQueries({ queryKey: ["knowledge-stats", slug] })).catch(() => {});
    }
    const saved = localStorage.getItem(`swing.rating.${slug}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { rating: number; comment?: string };
        setRating(parsed.rating);
        setComment(parsed.comment ?? "");
      } catch { /* ignore */ }
    }
  }, [slug, knowledgeId, track, qc]);

  const statsQ = useQuery({
    queryKey: ["knowledge-stats", slug],
    queryFn: () => fetchStats({ data: { slug } }),
    staleTime: 30_000,
  });

  const ratingMut = useMutation({
    mutationFn: async (v: { rating: number; comment: string }) =>
      rate({
        data: {
          slug,
          knowledgeId: knowledgeId ?? undefined,
          raterHash: hash,
          rating: v.rating,
          comment: v.comment || undefined,
        },
      }),
    onSuccess: (_d, v) => {
      localStorage.setItem(`swing.rating.${slug}`, JSON.stringify(v));
      toast.success("ขอบคุณสำหรับการประเมิน 🌟");
      qc.invalidateQueries({ queryKey: ["knowledge-stats", slug] });
    },
    onError: (e: Error) => toast.error(`บันทึกไม่สำเร็จ: ${e.message}`),
  });

  const stats = statsQ.data?.stats;
  const display = hovered || rating;

  return (
    <section className="mt-14 grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div className="rounded-xl border border-warm-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-magenta-600">
          สถิติการเข้าชม · Stats
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat icon={Eye} label="เปิดอ่าน" value={stats?.views ?? 0} />
          <Stat icon={Users} label="ผู้อ่านไม่ซ้ำ" value={stats?.uniqueViews ?? 0} />
          <Stat
            icon={Star}
            label={`คะแนน (${stats?.ratingCount ?? 0})`}
            value={stats?.ratingAvg ? stats.ratingAvg.toFixed(1) : "—"}
          />
        </div>
      </div>

      <div className="rounded-xl border border-warm-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-magenta-600">
          ประเมินเนื้อหา · Rate this lesson
        </p>
        <p className="mt-1 text-sm text-warm-500">
          เนื้อหานี้มีประโยชน์กับคุณมากแค่ไหน ความเห็นของคุณช่วยให้เราพัฒนาบทเรียนต่อไปได้
        </p>
        <div className="mt-4 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              className="cursor-pointer p-1 transition-transform hover:scale-110"
              aria-label={`${s} ดาว`}
            >
              <Star
                className={`h-7 w-7 ${
                  s <= display ? "fill-yellow-400 text-yellow-400" : "text-warm-300"
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm font-semibold text-navy-500">{rating}/5</span>
          )}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
          className="mt-3 w-full rounded-md border border-warm-200 px-3 py-2 text-sm text-navy-500 outline-none focus:border-magenta-400"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!rating || ratingMut.isPending || !hash}
            onClick={() => ratingMut.mutate({ rating, comment })}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-magenta-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ratingMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            ส่งคะแนน
          </button>
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg bg-cream/60 p-3">
      <Icon className="mx-auto h-5 w-5 text-magenta-500" />
      <p className="mt-1 text-xl font-bold text-navy-500">{value}</p>
      <p className="text-[11px] text-warm-500">{label}</p>
    </div>
  );
}
