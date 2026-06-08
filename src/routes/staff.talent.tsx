import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  X,
  Plus,
  Trash2,
  Sparkles,
  GraduationCap,
  Star,
  ShieldCheck,
  Trophy,
  PencilLine,
  Users as UsersIcon,
} from "lucide-react";
import seed from "@/data/seed-data.json";
import {
  useProductKnowledge,
  type KnowledgeAsset,
  type TalentMapping,
  type TalentRole,
  type EvidenceType,
} from "@/lib/product-knowledge-store";
import { summarizeTalent } from "@/lib/knowledge-ai.functions";

export const Route = createFileRoute("/staff/talent")({
  component: TalentPage,
});

type Person = {
  id: string;
  name: string;
  nameTh?: string;
  role: string;
  roleTh?: string;
  site: string;
  email?: string;
  avatarInitial: string;
};

const ROLE_WEIGHT: Record<TalentRole, number> = {
  expert: 4,
  trainer: 3,
  practitioner: 2,
  reviewer: 1.5,
  contributor: 1,
};

const ROLE_STYLES: Record<TalentRole, string> = {
  expert: "bg-amber-100 text-amber-700",
  trainer: "bg-success/15 text-success",
  practitioner: "bg-lavender-100 text-lavender-900",
  reviewer: "bg-sky-100 text-sky-700",
  contributor: "bg-warm-200 text-warm-700",
};

const ROLE_LABEL: Record<TalentRole, string> = {
  contributor: "Contributor",
  reviewer: "Reviewer",
  trainer: "Trainer",
  practitioner: "Practitioner",
  expert: "Expert",
};

const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  taught: "เคยสอน",
  fieldwork: "งานภาคสนาม",
  authored: "เขียนคู่มือ",
  led_session: "นำ session",
  other: "อื่นๆ",
};

function TalentPage() {
  const km = useProductKnowledge();
  const people = seed.staffConsole.people as Person[];

  const [q, setQ] = useState("");
  const [domain, setDomain] = useState<string>("all");
  const [site, setSite] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | TalentRole>("all");
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);

  const sites = useMemo(() => Array.from(new Set(people.map((p) => p.site))).sort(), [people]);

  const stats = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeStats>> = {};
    for (const p of people) {
      map[p.id] = computeStats(p.id, km.talentMappings, km.assets);
    }
    return map;
  }, [people, km.talentMappings, km.assets]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people.filter((p) => {
      if (site !== "all" && p.site !== site) return false;
      const st = stats[p.id];
      if (domain !== "all" && !st.domains.includes(domain)) return false;
      if (roleFilter !== "all" && !st.roles.includes(roleFilter)) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        (p.nameTh ?? "").toLowerCase().includes(needle) ||
        p.role.toLowerCase().includes(needle)
      );
    });
  }, [people, stats, q, site, domain, roleFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Talent Map</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Talent & Capacity</h1>
        <p className="mt-1 text-sm text-warm-500">
          เชื่อม Knowledge Product เข้ากับเจ้าหน้าที่ ดูศักยภาพ trainer / practitioner / expert ในแต่ละ domain
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาคน…"
            className="w-full rounded-pill border border-warm-200 bg-warm-50 py-2.5 pl-10 pr-4 text-sm text-navy-500 placeholder:text-warm-400 focus:border-magenta-500 focus:bg-white focus:outline-none"
          />
        </div>
        <FilterRow label="Domain">
          <Chip active={domain === "all"} onClick={() => setDomain("all")}>All</Chip>
          {Object.entries(km.categoryLabels).map(([k, v]) => (
            <Chip key={k} active={domain === k} onClick={() => setDomain(k)}>{v.th}</Chip>
          ))}
        </FilterRow>
        <FilterRow label="Location">
          <Chip active={site === "all"} onClick={() => setSite("all")}>All</Chip>
          {sites.map((s) => (
            <Chip key={s} active={site === s} onClick={() => setSite(s)}>{s}</Chip>
          ))}
        </FilterRow>
        <FilterRow label="Role">
          <Chip active={roleFilter === "all"} onClick={() => setRoleFilter("all")}>All</Chip>
          {(Object.keys(ROLE_LABEL) as TalentRole[]).map((r) => (
            <Chip key={r} active={roleFilter === r} onClick={() => setRoleFilter(r)}>{ROLE_LABEL[r]}</Chip>
          ))}
        </FilterRow>
      </div>

      <p className="text-xs text-warm-500">
        Showing <span className="font-semibold text-navy-500">{filtered.length}</span> of {people.length}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
          <UsersIcon className="mx-auto h-8 w-8 text-warm-400" />
          <p className="mt-3 text-sm font-semibold text-navy-500">ไม่พบเจ้าหน้าที่ที่ตรงเงื่อนไข</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <TalentCard
              key={p.id}
              person={p}
              stats={stats[p.id]}
              onOpen={() => setOpenPersonId(p.id)}
            />
          ))}
        </div>
      )}

      {openPersonId && (
        <TalentDrawer
          person={people.find((p) => p.id === openPersonId)!}
          onClose={() => setOpenPersonId(null)}
        />
      )}
    </div>
  );
}

function computeStats(personId: string, mappings: TalentMapping[], assets: KnowledgeAsset[]) {
  const mine = mappings.filter((m) => m.personId === personId);
  const roles = Array.from(new Set(mine.map((m) => m.role))) as TalentRole[];
  const domains = Array.from(
    new Set(
      mine.flatMap((m) => assets.find((a) => a.id === m.assetId)?.categories ?? []),
    ),
  );
  let score = 0;
  for (const m of mine) {
    score += ROLE_WEIGHT[m.role] + Math.min(m.evidence.length * 0.5, 2);
  }
  const evidenceTotal = mine.reduce((sum, m) => sum + m.evidence.length, 0);
  const trainerCount = mine.filter((m) => m.role === "trainer" || m.role === "expert").length;
  const expertCount = mine.filter((m) => m.role === "expert").length;

  const trainerReady = trainerCount >= 1 && evidenceTotal >= 2;
  const expertPotential = expertCount >= 1 || (trainerCount >= 1 && mine.length >= 2 && evidenceTotal >= 3);

  return {
    mappings: mine,
    roles,
    domains,
    score: Math.round(score * 10) / 10,
    evidenceTotal,
    trainerReady,
    expertPotential,
  };
}

type Stats = ReturnType<typeof computeStats>;

function TalentCard({ person, stats, onOpen }: { person: Person; stats: Stats; onOpen: () => void }) {
  const km = useProductKnowledge();
  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col rounded-lg border border-warm-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-magenta-500 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-lg font-semibold text-lavender-900">
          {person.avatarInitial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-navy-500">{person.nameTh ?? person.name}</p>
          <p className="truncate text-xs text-warm-500">{person.roleTh ?? person.role}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warm-400">
            <MapPin className="h-3 w-3" />
            {person.site}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-warm-500">Score</p>
          <p className="text-xl font-bold text-magenta-500">{stats.score || "-"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {stats.trainerReady && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
            <GraduationCap className="h-3 w-3" /> Trainer-ready
          </span>
        )}
        {stats.expertPotential && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            <Trophy className="h-3 w-3" /> Expert potential
          </span>
        )}
        {!stats.trainerReady && !stats.expertPotential && stats.mappings.length === 0 && (
          <span className="text-[11px] text-warm-400">ยังไม่มี knowledge mapping</span>
        )}
      </div>

      {stats.domains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {stats.domains.slice(0, 4).map((d) => (
            <span key={d} className="inline-flex items-center rounded-pill bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-900">
              {km.categoryLabels[d]?.th ?? d}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11px] text-warm-500">
        <span>{stats.mappings.length} knowledge · {stats.evidenceTotal} evidence</span>
        <PencilLine className="h-3 w-3 text-warm-400 group-hover:text-magenta-500" />
      </div>
    </button>
  );
}

function TalentDrawer({ person, onClose }: { person: Person; onClose: () => void }) {
  const km = useProductKnowledge();
  const summarize = useServerFn(summarizeTalent);
  const [adding, setAdding] = useState(false);
  const [pickAssetId, setPickAssetId] = useState("");
  const [pickRole, setPickRole] = useState<TalentRole>("contributor");
  const [aiOut, setAiOut] = useState<{ strengths: string[]; growAreas: string[]; summary: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const mine = km.talentMappings.filter((m) => m.personId === person.id);
  const stats = computeStats(person.id, km.talentMappings, km.assets);

  const addMapping = () => {
    if (!pickAssetId) return toast.error("เลือก knowledge ก่อน");
    km.upsertTalentMapping(person.id, pickAssetId, pickRole);
    toast.success("เชื่อม mapping แล้ว");
    setPickAssetId("");
    setAdding(false);
  };

  const runAi = async () => {
    if (mine.length === 0) return toast.error("ยังไม่มี mapping ให้สรุป");
    setAiLoading(true);
    try {
      const out = await summarize({
        data: {
          personName: person.nameTh ?? person.name,
          personRole: person.roleTh ?? person.role,
          personSite: person.site,
          mappings: mine.map((m) => {
            const a = km.assets.find((x) => x.id === m.assetId);
            return {
              assetTitle: a?.titleTh || a?.titleEn || "untitled",
              domain: a?.categories[0],
              role: m.role,
              competencyTags: a?.competencyTags ?? [],
              evidenceCount: m.evidence.length,
              evidenceTypes: m.evidence.map((e) => e.type),
            };
          }),
        },
      });
      setAiOut(out);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button aria-label="Close" onClick={onClose} className="flex-1 bg-navy-900/50 backdrop-blur-sm" />
      <div className="flex w-full max-w-2xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-warm-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-lavender-100 text-lg font-semibold text-lavender-900">
              {person.avatarInitial}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-navy-500">{person.nameTh ?? person.name}</h2>
              <p className="text-xs text-warm-500">{person.roleTh ?? person.role} · {person.site}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-warm-500 hover:bg-warm-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Indicators */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Competency score" value={stats.score || 0} icon={Star} tone="magenta" />
            <Stat label="Trainer ready" value={stats.trainerReady ? "Yes" : "—"} icon={GraduationCap} tone={stats.trainerReady ? "success" : "muted"} />
            <Stat label="Expert potential" value={stats.expertPotential ? "Yes" : "—"} icon={Trophy} tone={stats.expertPotential ? "amber" : "muted"} />
          </div>

          {/* AI summary */}
          <div className="rounded-lg border border-lavender-200 bg-lavender-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lavender-900">
                <Sparkles className="h-3.5 w-3.5" /> AI talent insight
              </p>
              <button
                onClick={runAi}
                disabled={aiLoading || mine.length === 0}
                className="rounded-pill bg-lavender-900 px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {aiLoading ? "กำลังวิเคราะห์…" : "สรุปด้วย AI"}
              </button>
            </div>
            {aiOut ? (
              <div className="space-y-2 text-sm text-navy-500">
                <p className="leading-relaxed">{aiOut.summary}</p>
                {aiOut.strengths.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-warm-500">ถนัด</p>
                    <ul className="ml-4 list-disc text-xs">{aiOut.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {aiOut.growAreas.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-warm-500">ควรพัฒนาต่อ</p>
                    <ul className="ml-4 list-disc text-xs">{aiOut.growAreas.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-warm-500">กดสรุปเพื่อให้ AI ช่วยวิเคราะห์ความถนัดและจุดที่ควรพัฒนา</p>
            )}
          </div>

          {/* Mappings */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Knowledge mappings ({mine.length})</p>
              <button
                onClick={() => setAdding((v) => !v)}
                className="inline-flex items-center gap-1 rounded-pill bg-magenta-500 px-3 py-1 text-[11px] font-semibold text-white hover:bg-magenta-600"
              >
                <Plus className="h-3 w-3" /> เชื่อม knowledge
              </button>
            </div>

            {adding && (
              <div className="mb-3 space-y-2 rounded-md border border-warm-200 bg-warm-50 p-3">
                <select
                  value={pickAssetId}
                  onChange={(e) => setPickAssetId(e.target.value)}
                  className="w-full rounded-md border border-warm-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— เลือก Knowledge Product —</option>
                  {km.assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.titleTh || a.titleEn}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ROLE_LABEL) as TalentRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setPickRole(r)}
                      className={`rounded-pill border px-3 py-1 text-xs font-semibold transition-colors ${
                        pickRole === r
                          ? "border-magenta-500 bg-magenta-500 text-white"
                          : "border-warm-200 bg-white text-warm-700 hover:border-magenta-500"
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setAdding(false)} className="rounded-pill border border-warm-200 px-3 py-1.5 text-xs font-semibold text-warm-700 hover:bg-warm-100">ยกเลิก</button>
                  <button onClick={addMapping} className="rounded-pill bg-magenta-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-magenta-600">บันทึก</button>
                </div>
              </div>
            )}

            {mine.length === 0 ? (
              <p className="rounded-md border border-dashed border-warm-200 p-4 text-center text-xs text-warm-500">
                ยังไม่มี knowledge mapping
              </p>
            ) : (
              <div className="space-y-3">
                {mine.map((m) => {
                  const a = km.assets.find((x) => x.id === m.assetId);
                  if (!a) return null;
                  return <MappingItem key={m.id} mapping={m} asset={a} />;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MappingItem({ mapping, asset }: { mapping: TalentMapping; asset: KnowledgeAsset }) {
  const km = useProductKnowledge();
  const [showEv, setShowEv] = useState(false);
  const [evType, setEvType] = useState<EvidenceType>("taught");
  const [evNote, setEvNote] = useState("");
  const [evDate, setEvDate] = useState(() => new Date().toISOString().slice(0, 10));

  const addEv = () => {
    if (!evNote.trim()) return toast.error("กรอกรายละเอียดหลักฐาน");
    km.addTalentEvidence(mapping.id, { type: evType, note: evNote.trim(), date: evDate });
    setEvNote("");
    toast.success("เพิ่มหลักฐานแล้ว");
  };

  return (
    <div className="rounded-md border border-warm-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy-500">{asset.titleTh || asset.titleEn}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[mapping.role]}`}>
              {ROLE_LABEL[mapping.role]}
            </span>
            {asset.categories.slice(0, 2).map((c) => (
              <span key={c} className="inline-flex items-center rounded-pill bg-lavender-100 px-2 py-0.5 text-[11px] font-semibold text-lavender-900">
                {km.categoryLabels[c]?.th ?? c}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-pill border border-warm-200 px-2 py-0.5 text-[11px] font-semibold text-warm-700">
              <ShieldCheck className="h-3 w-3" /> {mapping.evidence.length} evidence
            </span>
          </div>
        </div>
        <button onClick={() => km.removeTalentMapping(mapping.id)} className="rounded-md p-1.5 text-warm-400 hover:bg-danger/10 hover:text-danger">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <button onClick={() => setShowEv((v) => !v)} className="mt-2 text-[11px] font-semibold text-magenta-500 hover:underline">
        {showEv ? "ซ่อน" : "ดู / เพิ่มหลักฐาน"}
      </button>

      {showEv && (
        <div className="mt-2 space-y-2 border-t border-warm-100 pt-2">
          {mapping.evidence.map((ev) => (
            <div key={ev.id} className="flex items-start justify-between gap-2 rounded-md bg-warm-50 px-2 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-navy-500">{EVIDENCE_LABEL[ev.type]}</span>
                <span className="ml-1.5 text-warm-500">· {new Date(ev.date).toLocaleDateString()}</span>
                <p className="text-warm-700">{ev.note}</p>
              </div>
              <button onClick={() => km.removeTalentEvidence(mapping.id, ev.id)} className="rounded p-1 text-warm-400 hover:text-danger">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="space-y-1.5 rounded-md border border-dashed border-warm-200 p-2">
            <div className="flex gap-1.5">
              <select
                value={evType}
                onChange={(e) => setEvType(e.target.value as EvidenceType)}
                className="rounded-md border border-warm-200 bg-white px-2 py-1 text-xs"
              >
                {(Object.keys(EVIDENCE_LABEL) as EvidenceType[]).map((t) => (
                  <option key={t} value={t}>{EVIDENCE_LABEL[t]}</option>
                ))}
              </select>
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="rounded-md border border-warm-200 bg-white px-2 py-1 text-xs"
              />
            </div>
            <input
              value={evNote}
              onChange={(e) => setEvNote(e.target.value)}
              placeholder="รายละเอียด เช่น สอน workshop PrEP ที่สีลม 2 ครั้ง"
              className="w-full rounded-md border border-warm-200 bg-white px-2 py-1 text-xs"
            />
            <button onClick={addEv} className="w-full rounded-pill bg-navy-500 px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90">
              + เพิ่มหลักฐาน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-warm-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-magenta-500 bg-magenta-500 text-white"
          : "border-warm-200 bg-white text-warm-700 hover:border-magenta-500"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "magenta" | "success" | "amber" | "muted";
}) {
  const toneClass =
    tone === "magenta"
      ? "bg-magenta-500/10 text-magenta-600"
      : tone === "success"
      ? "bg-success/15 text-success"
      : tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : "bg-warm-100 text-warm-500";
  return (
    <div className="rounded-lg border border-warm-200 bg-white p-3">
      <div className={`mb-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${toneClass}`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-lg font-bold text-navy-500">{value}</p>
    </div>
  );
}
