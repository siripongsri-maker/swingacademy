// Parse a baseline inventory CSV (e.g. Baseline_training_inventory_LINE.csv) into import rows.
// Runs in the browser; the server re-validates everything with zod.
import type { BaselineImportRow, KnowledgeLevel } from "@/lib/baseline.functions";

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF, optional UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// Artifact codes used by the inventory, strongest knowledge first.
// DC content file · S written summary · R recording · DA admin papers · P photos/posts · L links · X album deleted
const LEVEL_BY_CODE: [string, KnowledgeLevel][] = [
  ["DC", "content_file"],
  ["S", "written_summary"],
  ["R", "recording"],
  ["DA", "admin_only"],
  ["P", "photos_or_links"],
  ["L", "photos_or_links"],
  ["X", "deleted"],
];

export function knowledgeLevelFromArtifacts(artifacts: string): KnowledgeLevel {
  const m = artifacts.trim().match(/^\[([A-Z+]+|none)\]/);
  if (!m) return artifacts.trim() ? "unknown" : "none";
  if (m[1] === "none") return "none";
  const codes = m[1].split("+");
  for (const [code, level] of LEVEL_BY_CODE) {
    if (codes.includes(code)) return level;
  }
  return "unknown";
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Best usable date for filtering. Exact ISO dates pass through; "2026-06 (approx.)" becomes
 * 2026-06-01 and "on or before 2026-03-04" becomes 2026-03-04. Vague values ("unknown",
 * "~2024") stay null. The raw text is kept in date_note either way.
 */
function realDate(s: string): string | null {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

function usableDate(raw: string | null): string | null {
  if (!raw) return null;
  if (ISO.test(raw)) return realDate(raw);
  const month = raw.match(/^(\d{4}-\d{2}) \(approx/i);
  if (month) return realDate(`${month[1]}-01`);
  const onOrBefore = raw.match(/^on or before (\d{4}-\d{2}-\d{2})/i);
  if (onOrBefore) return realDate(onOrBefore[1]);
  return null;
}
const clean = (v: string | undefined) => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

export type ParsedInventory = {
  rows: BaselineImportRow[];
  skipped: { line: number; reason: string }[];
  missingColumns: string[];
};

const REQUIRED = ["id", "title"];

/** Map inventory CSV columns (id, date_start, title, ... evidence) to import rows. */
export function mapInventory(table: string[][]): ParsedInventory {
  const [header = [], ...body] = table;
  const cols = header.map((h) => h.trim().toLowerCase());
  const missingColumns = REQUIRED.filter((c) => !cols.includes(c));
  const get = (r: string[], name: string) => {
    const i = cols.indexOf(name);
    return i >= 0 ? r[i] : undefined;
  };

  const rows: BaselineImportRow[] = [];
  const skipped: ParsedInventory["skipped"] = [];
  const seen = new Set<string>();
  if (missingColumns.length) return { rows, skipped, missingColumns };

  body.forEach((r, idx) => {
    const line = idx + 2; // 1-based, after the header
    const externalId = clean(get(r, "id"));
    const title = clean(get(r, "title"));
    if (!externalId || !title) {
      skipped.push({ line, reason: "missing id or title" });
      return;
    }
    if (seen.has(externalId)) {
      skipped.push({ line, reason: `duplicate id ${externalId}` });
      return;
    }
    seen.add(externalId);
    const rawStart = clean(get(r, "date_start"));
    const rawEnd = clean(get(r, "date_end"));
    const startIso = usableDate(rawStart);
    const endIso = usableDate(rawEnd);
    const dateNote =
      [
        rawStart && startIso !== rawStart ? rawStart : null,
        rawEnd && endIso !== rawEnd ? `end: ${rawEnd}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;
    const artifacts = clean(get(r, "artifacts"));
    rows.push({
      externalId,
      sourceGroup: clean(get(r, "groups")),
      title,
      topicArea: clean(get(r, "topic_area")),
      dateStart: startIso,
      dateEnd: endIso,
      dateNote,
      swingRole: clean(get(r, "swing_role")),
      organiser: clean(get(r, "organiser")),
      audience: clean(get(r, "audience")),
      format: clean(get(r, "format")),
      status: clean(get(r, "status")),
      artifacts,
      knowledgeLevel: knowledgeLevelFromArtifacts(artifacts ?? ""),
      confidence: clean(get(r, "confidence")),
      verified: /^(true|yes|1|y)$/i.test((get(r, "verified") ?? "").trim()),
      evidence: clean(get(r, "evidence")),
      notes: null,
    });
  });
  return { rows, skipped, missingColumns };
}
