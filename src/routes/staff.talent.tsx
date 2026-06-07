import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, GraduationCap } from "lucide-react";
import seed from "@/data/seed-data.json";

export const Route = createFileRoute("/staff/talent")({
  component: TalentPage,
});

type Level = "trainer" | "practitioner" | "aware";

const levelStyle: Record<Level, { bg: string; text: string; label: string }> = {
  trainer: { bg: "rgba(31, 138, 91, 0.15)", text: "#1F8A5B", label: "Trainer" },
  practitioner: { bg: "rgba(122, 111, 196, 0.18)", text: "#4C4293", label: "Practitioner" },
  aware: { bg: "rgba(214, 210, 204, 0.5)", text: "#6E665E", label: "Aware" },
};

function TalentPage() {
  const sc = seed.staffConsole;
  const [domain, setDomain] = useState<string>("all");
  const [trainersOnly, setTrainersOnly] = useState(false);

  const domains = sc.domainLabels as Record<string, string>;

  const filteredPeople = useMemo(() => {
    return sc.people.filter((person) => {
      const personSkills = sc.personSkills.filter((ps) => ps.personId === person.id);
      if (personSkills.length === 0 && (domain !== "all" || trainersOnly)) return false;

      if (domain !== "all") {
        const hasInDomain = personSkills.some((ps) => {
          const skill = sc.skills.find((s) => s.id === ps.skillId);
          return skill?.domain === domain;
        });
        if (!hasInDomain) return false;
      }
      if (trainersOnly) {
        const isTrainer = personSkills.some((ps) => ps.level === "trainer");
        if (!isTrainer) return false;
      }
      return true;
    });
  }, [sc.people, sc.personSkills, sc.skills, domain, trainersOnly]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-warm-500">Talent Map</p>
        <h1 className="mt-1 text-3xl font-semibold text-navy-500">Who knows what</h1>
        <p className="mt-1 text-sm text-warm-500">
          Staff skills across sites — find trainers, practitioners and people building awareness.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-warm-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-warm-500">
            Domain
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={domain === "all"} onClick={() => setDomain("all")}>All</Chip>
            {Object.entries(domains).map(([k, v]) => (
              <Chip key={k} active={domain === k} onClick={() => setDomain(k)}>
                {v}
              </Chip>
            ))}
          </div>
        </div>

        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-navy-500">
          <input
            type="checkbox"
            checked={trainersOnly}
            onChange={(e) => setTrainersOnly(e.target.checked)}
            className="h-4 w-4 rounded border-warm-300 text-magenta-500 focus:ring-magenta-500"
          />
          <GraduationCap className="h-4 w-4 text-success" />
          Trainers only
        </label>
      </div>

      {filteredPeople.length === 0 ? (
        <div className="rounded-lg border border-dashed border-warm-200 bg-white p-12 text-center">
          <p className="text-sm font-semibold text-navy-500">No people match this filter</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPeople.map((person) => {
            const personSkills = sc.personSkills.filter((ps) => ps.personId === person.id);
            return (
              <article
                key={person.id}
                className="overflow-hidden rounded-lg border border-warm-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-lavender-100 text-lg font-semibold text-lavender-900">
                    {person.avatarInitial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-navy-500">
                      {person.name}
                    </p>
                    <p className="truncate text-xs text-warm-500">{person.role}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-warm-400">
                      <MapPin className="h-3 w-3" />
                      {person.site}
                    </p>
                  </div>
                </div>

                {personSkills.length > 0 && (
                  <div className="mt-4 border-t border-warm-200 pt-4">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-warm-500">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {personSkills.map((ps) => {
                        const skill = sc.skills.find((s) => s.id === ps.skillId);
                        const s = levelStyle[ps.level as Level];
                        if (!skill) return null;
                        return (
                          <span
                            key={ps.skillId}
                            className="inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ backgroundColor: s.bg, color: s.text }}
                            title={s.label}
                          >
                            {skill.name}
                            <span className="opacity-70">· {s.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
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
