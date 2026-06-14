// DB-backed knowledge store.
//
// `assets` is the single source of truth for both /staff/knowledge
// (and friends) AND the public /knowledge pages. Reads go through
// `listStaffKnowledgeAssets` (staff RLS) on the staff side and through
// `listPublicKnowledge` on the public side; writes go through
// `saveKnowledgeAsset` and `deleteKnowledgeAsset`, which invalidate both
// staff and public caches so the two surfaces stay in sync.
//
// Translations / collections / talent mappings still live in localStorage
// because there are no DB tables for them yet (TODO: migrate).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import seed from "@/data/product-knowledge-seed.json";
import {
  listStaffKnowledgeAssets,
  saveKnowledgeAsset,
  deleteKnowledgeAsset,
} from "@/lib/knowledge-assets.functions";
import {
  listTalentMappings,
  upsertTalentMapping as upsertTalentMappingFn,
  removeTalentMapping as removeTalentMappingFn,
  addTalentEvidence as addTalentEvidenceFn,
  removeTalentEvidence as removeTalentEvidenceFn,
} from "@/lib/talent-mappings.functions";
import {
  listTranslations as listTranslationsFn,
  saveTranslation as saveTranslationFn,
  removeTranslation as removeTranslationFn,
  type TranslationRow,
} from "@/lib/knowledge-translations.functions";

export type KnowledgeType =
  | "training"
  | "field_note"
  | "sop"
  | "campaign"
  | "partner_resource"
  | "health_product"
  | "service_guide"
  | "community_insight"
  | "curriculum"
  | "toolkit"
  | "research_summary";

export type KnowledgeStatus = "draft" | "review" | "published" | "archived";
export type Visibility = "private" | "staff" | "public";
export type SourceType = "internal" | "url" | "article" | "social" | "partner";
export type Language = "th" | "en" | "bilingual";

export type Attachment = {
  id: string;
  kind: "pdf" | "slides" | "image" | "video_url" | "audio";
  title?: string;
  externalUrl?: string;
};
export type VersionEntry = { v: string; at: string; by: string; note: string };

export type QaChecklist = {
  titleClear?: boolean;
  keyMessageOk?: boolean;
  sourceCited?: boolean;
  languageOk?: boolean;
  nonStigmatizing?: boolean;
  expertReviewed?: boolean;
};

export type KnowledgeAsset = {
  id: string;
  slug: string;
  titleTh: string;
  titleEn: string;
  summary: string;
  type: KnowledgeType;
  categories: string[];
  productService: string;
  audiences: string[];
  keyMessage: string;
  contentMd: string;
  source: string;
  sourceType: SourceType;
  sourceUrl?: string;
  tags: string[];
  language: Language;
  status: KnowledgeStatus;
  visibility: Visibility;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  versionHistory: VersionEntry[];
  attachments: Attachment[];
  learningObjectives?: string[];
  competencyTags?: string[];
  relatedServices?: string[];
  relatedCourses?: string[];
  linkedCurriculum?: string;
  qaChecklist?: QaChecklist;
  approvedAt?: string;
  approvedBy?: string;
};

export type KnowledgeCollection = {
  id: string;
  name: string;
  description: string;
  domain: string;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TranslationStatus = "draft" | "ready" | "published";
export type KnowledgeTranslation = {
  id: string;
  assetId: string;
  audience: string;
  format: string;
  tone: string;
  language: Language;
  instruction: string;
  outputMd: string;
  title?: string | null;
  contributorId?: string | null;
  heroImageUrl?: string | null;
  status: TranslationStatus;
  ownerId: string;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TalentRole = "contributor" | "reviewer" | "trainer" | "practitioner" | "expert";
export type EvidenceType = "taught" | "fieldwork" | "authored" | "led_session" | "other";

export type TalentEvidence = {
  id: string;
  type: EvidenceType;
  note: string;
  date: string;
};

export type TalentMapping = {
  id: string;
  personId: string;
  assetId: string;
  role: TalentRole;
  evidence: TalentEvidence[];
  createdAt: string;
  updatedAt: string;
};

type CreateAssetInput = Omit<
  KnowledgeAsset,
  "id" | "slug" | "createdAt" | "updatedAt" | "versionHistory"
> & { slug?: string };

type LocalState = {
  collections: KnowledgeCollection[];
};

type StoreCtx = {
  assets: KnowledgeAsset[];
  translations: KnowledgeTranslation[];
  collections: KnowledgeCollection[];
  talentMappings: TalentMapping[];
  isLoading: boolean;
  audiences: Array<{ id: string; th: string; en: string }>;
  formats: Array<{ id: string; th: string; en: string }>;
  tones: Array<{ id: string; th: string; en: string }>;
  categoryLabels: Record<string, { th: string; en: string }>;
  typeLabels: Record<string, { th: string; en: string }>;
  createAsset: (a: CreateAssetInput) => KnowledgeAsset;
  updateAsset: (id: string, patch: Partial<KnowledgeAsset>, note?: string) => void;
  removeAsset: (id: string) => void;
  getAsset: (id: string) => KnowledgeAsset | undefined;
  getAssetBySlug: (slug: string) => KnowledgeAsset | undefined;
  createTranslation: (t: Omit<KnowledgeTranslation, "id" | "createdAt" | "updatedAt">) => KnowledgeTranslation;
  updateTranslation: (id: string, patch: Partial<KnowledgeTranslation>) => void;
  removeTranslation: (id: string) => void;
  getTranslation: (id: string) => KnowledgeTranslation | undefined;
  createCollection: (c: Omit<KnowledgeCollection, "id" | "createdAt" | "updatedAt">) => KnowledgeCollection;
  updateCollection: (id: string, patch: Partial<KnowledgeCollection>) => void;
  removeCollection: (id: string) => void;
  upsertTalentMapping: (personId: string, assetId: string, role: TalentRole) => TalentMapping;
  removeTalentMapping: (id: string) => void;
  addTalentEvidence: (mappingId: string, e: Omit<TalentEvidence, "id">) => void;
  removeTalentEvidence: (mappingId: string, evidenceId: string) => void;
  slugify: (input: string) => string;
  reset: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);
const LS_KEY = "swing.product-knowledge.local.v1";

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function slugify(input: string): string {
  const base = (input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return base || `k-${Date.now().toString(36)}`;
}

function loadLocal(): LocalState {
  if (typeof window === "undefined") return { collections: [] };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalState>;
      return {
        collections: parsed.collections ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return { collections: [] };
}

function asKnowledgeAsset(a: unknown): KnowledgeAsset {
  // Server returns a structurally-compatible shape (string status/visibility,
  // attachments as plain records). Cast through unknown to KnowledgeAsset.
  return a as KnowledgeAsset;
}

export function ProductKnowledgeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listStaffKnowledgeAssets);
  const saveFn = useServerFn(saveKnowledgeAsset);
  const removeFn = useServerFn(deleteKnowledgeAsset);

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", "staff", "all"],
    queryFn: async () => {
      try {
        return await fetchAll();
      } catch {
        // Provider runs on public pages too; 401 just means "not signed in".
        return { items: [] as unknown[] };
      }
    },
    staleTime: 30_000,
  });
  const assets: KnowledgeAsset[] = useMemo(
    () => ((data?.items ?? []) as unknown[]).map(asKnowledgeAsset),
    [data],
  );

  const [local, setLocal] = useState<LocalState>(() => ({ translations: [], collections: [] }));
  useEffect(() => setLocal(loadLocal()), []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(local));
    } catch {
      /* ignore */
    }
  }, [local]);

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["knowledge", "staff", "all"] });
    qc.invalidateQueries({ queryKey: ["knowledge", "public", "all"] });
    qc.invalidateQueries({ queryKey: ["knowledge", "featured"] });
    qc.invalidateQueries({ queryKey: ["knowledge", "public"] });
  }, [qc]);

  // ---- Asset mutations: fire-and-forget; cache updates via invalidate. ----

  const createAsset: StoreCtx["createAsset"] = useCallback(
    (a) => {
      const now = new Date().toISOString();
      const slug = slugify(a.slug || a.titleEn || a.titleTh || "knowledge");
      // Optimistic placeholder so callers that read the return value still get something.
      const optimistic: KnowledgeAsset = {
        ...a,
        slug,
        id: uid("pk"),
        createdAt: now,
        updatedAt: now,
        versionHistory: [{ v: "1.0", at: now, by: "You", note: "Created" }],
      };
      // Fire DB insert in the background
      void (async () => {
        try {
          await saveFn({
            data: {
              patch: {
                slug,
                titleTh: a.titleTh,
                titleEn: a.titleEn,
                summary: a.summary,
                keyMessage: a.keyMessage,
                contentMd: a.contentMd,
                type: a.type,
                categories: a.categories,
                productService: a.productService,
                audiences: a.audiences,
                source: a.source,
                sourceType: a.sourceType,
                sourceUrl: a.sourceUrl,
                tags: a.tags,
                language: a.language,
                status: a.status,
                visibility: a.visibility,
                learningObjectives: a.learningObjectives,
                competencyTags: a.competencyTags,
                relatedServices: a.relatedServices,
                relatedCourses: a.relatedCourses,
                linkedCurriculum: a.linkedCurriculum,
                qaChecklist: a.qaChecklist,
                attachments: a.attachments,
                versionHistory: optimistic.versionHistory,
              },
            },
          });
          invalidateAll();
        } catch (e) {
          console.error("[knowledge] createAsset failed", e);
        }
      })();
      return optimistic;
    },
    [saveFn, invalidateAll],
  );

  const updateAsset: StoreCtx["updateAsset"] = useCallback(
    (id, patch, note) => {
      const existing = assets.find((a) => a.id === id);
      const lastV = parseFloat(existing?.versionHistory.at(-1)?.v ?? "1.0");
      const nextV = (lastV + 0.1).toFixed(1);
      const nextHistory = note && existing
        ? [...existing.versionHistory, { v: nextV, at: new Date().toISOString(), by: "You", note }]
        : undefined;
      // Optimistically update cache so UI reflects immediately
      qc.setQueryData(["knowledge", "staff", "all"], (prev: { items: KnowledgeAsset[] } | undefined) => {
        if (!prev) return prev;
        return {
          items: prev.items.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                  versionHistory: nextHistory ?? a.versionHistory,
                }
              : a,
          ),
        };
      });
      void (async () => {
        try {
          await saveFn({
            data: {
              id,
              patch: {
                ...(patch.slug !== undefined ? { slug: slugify(patch.slug) } : {}),
                ...(patch.titleTh !== undefined ? { titleTh: patch.titleTh } : {}),
                ...(patch.titleEn !== undefined ? { titleEn: patch.titleEn } : {}),
                ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
                ...(patch.keyMessage !== undefined ? { keyMessage: patch.keyMessage } : {}),
                ...(patch.contentMd !== undefined ? { contentMd: patch.contentMd } : {}),
                ...(patch.type !== undefined ? { type: patch.type } : {}),
                ...(patch.categories !== undefined ? { categories: patch.categories } : {}),
                ...(patch.productService !== undefined ? { productService: patch.productService } : {}),
                ...(patch.audiences !== undefined ? { audiences: patch.audiences } : {}),
                ...(patch.source !== undefined ? { source: patch.source } : {}),
                ...(patch.sourceType !== undefined ? { sourceType: patch.sourceType } : {}),
                ...(patch.sourceUrl !== undefined ? { sourceUrl: patch.sourceUrl } : {}),
                ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
                ...(patch.language !== undefined ? { language: patch.language } : {}),
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
                ...(patch.learningObjectives !== undefined ? { learningObjectives: patch.learningObjectives } : {}),
                ...(patch.competencyTags !== undefined ? { competencyTags: patch.competencyTags } : {}),
                ...(patch.relatedServices !== undefined ? { relatedServices: patch.relatedServices } : {}),
                ...(patch.relatedCourses !== undefined ? { relatedCourses: patch.relatedCourses } : {}),
                ...(patch.linkedCurriculum !== undefined ? { linkedCurriculum: patch.linkedCurriculum } : {}),
                ...(patch.qaChecklist !== undefined ? { qaChecklist: patch.qaChecklist } : {}),
                ...(patch.attachments !== undefined ? { attachments: patch.attachments } : {}),
                ...(patch.approvedAt !== undefined ? { approvedAt: patch.approvedAt } : {}),
                ...(patch.approvedBy !== undefined ? { approvedBy: patch.approvedBy } : {}),
                ...(nextHistory ? { versionHistory: nextHistory } : {}),
              },
            },
          });
          invalidateAll();
        } catch (e) {
          console.error("[knowledge] updateAsset failed", e);
          invalidateAll();
        }
      })();
    },
    [assets, qc, saveFn, invalidateAll],
  );

  const removeAsset: StoreCtx["removeAsset"] = useCallback(
    (id) => {
      qc.setQueryData(["knowledge", "staff", "all"], (prev: { items: KnowledgeAsset[] } | undefined) =>
        prev ? { items: prev.items.filter((a) => a.id !== id) } : prev,
      );
      setLocal((s) => ({
        ...s,
        collections: s.collections.map((c) => ({ ...c, assetIds: c.assetIds.filter((x) => x !== id) })),
      }));
      void (async () => {
        try {
          await removeFn({ data: { id } });
          invalidateAll();
        } catch (e) {
          console.error("[knowledge] removeAsset failed", e);
          invalidateAll();
        }
      })();
    },
    [qc, removeFn, invalidateAll],
  );

  // ---- Translations: DB-backed via server fns ----
  const fetchTranslations = useServerFn(listTranslationsFn);
  const saveTranslationS = useServerFn(saveTranslationFn);
  const removeTranslationS = useServerFn(removeTranslationFn);

  const { data: translationsData } = useQuery({
    queryKey: ["knowledge-translations", "all"],
    queryFn: async () => {
      try {
        return await fetchTranslations();
      } catch {
        return { items: [] as TranslationRow[] };
      }
    },
    staleTime: 30_000,
  });
  const translations: KnowledgeTranslation[] = useMemo(
    () =>
      ((translationsData?.items ?? []) as TranslationRow[]).map((r) => ({
        id: r.id,
        assetId: r.assetId,
        audience: r.audience,
        format: r.format,
        tone: r.tone,
        language: r.language as Language,
        instruction: r.instruction,
        outputMd: r.outputMd,
        title: r.title,
        contributorId: r.contributorId,
        heroImageUrl: r.heroImageUrl,
        status: r.status,
        ownerId: r.ownerId ?? "",
        publishedAt: r.publishedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    [translationsData],
  );

  const invalidateTranslations = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["knowledge-translations"] });
    qc.invalidateQueries({ queryKey: ["knowledge", "public", "translations"] });
  }, [qc]);

  const createTranslation: StoreCtx["createTranslation"] = useCallback(
    (t) => {
      const now = new Date().toISOString();
      const optimistic: KnowledgeTranslation = {
        ...t,
        id: uid("kt"),
        createdAt: now,
        updatedAt: now,
      };
      void (async () => {
        try {
          await saveTranslationS({
            data: {
              assetId: t.assetId,
              audience: t.audience,
              format: t.format,
              tone: t.tone,
              language: t.language,
              instruction: t.instruction,
              outputMd: t.outputMd,
              title: t.title ?? null,
              status: t.status,
              contributorId: t.contributorId ?? null,
              heroImageUrl: t.heroImageUrl ?? null,
            },
          });
          invalidateTranslations();
        } catch (e) {
          console.error("[translation] create failed", e);
          invalidateTranslations();
        }
      })();
      return optimistic;
    },
    [saveTranslationS, invalidateTranslations],
  );

  const updateTranslation: StoreCtx["updateTranslation"] = useCallback(
    (id, patch) => {
      const existing = translations.find((t) => t.id === id);
      if (!existing) return;
      const merged = { ...existing, ...patch };
      void (async () => {
        try {
          await saveTranslationS({
            data: {
              id,
              assetId: merged.assetId,
              audience: merged.audience,
              format: merged.format,
              tone: merged.tone,
              language: merged.language,
              instruction: merged.instruction,
              outputMd: merged.outputMd,
              title: merged.title ?? null,
              status: merged.status,
              contributorId: merged.contributorId ?? null,
              heroImageUrl: merged.heroImageUrl ?? null,
            },
          });
          invalidateTranslations();
        } catch (e) {
          console.error("[translation] update failed", e);
          invalidateTranslations();
        }
      })();
    },
    [translations, saveTranslationS, invalidateTranslations],
  );

  const removeTranslation: StoreCtx["removeTranslation"] = useCallback(
    (id) => {
      qc.setQueryData(
        ["knowledge-translations", "all"],
        (prev: { items: TranslationRow[] } | undefined) =>
          prev ? { items: prev.items.filter((t) => t.id !== id) } : prev,
      );
      void (async () => {
        try {
          await removeTranslationS({ data: { id } });
          invalidateTranslations();
        } catch (e) {
          console.error("[translation] remove failed", e);
          invalidateTranslations();
        }
      })();
    },
    [qc, removeTranslationS, invalidateTranslations],
  );


  const createCollection: StoreCtx["createCollection"] = useCallback((c) => {
    const now = new Date().toISOString();
    const created: KnowledgeCollection = { ...c, id: uid("col"), createdAt: now, updatedAt: now };
    setLocal((s) => ({ ...s, collections: [created, ...s.collections] }));
    return created;
  }, []);
  const updateCollection: StoreCtx["updateCollection"] = useCallback((id, patch) => {
    setLocal((s) => ({
      ...s,
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      ),
    }));
  }, []);
  const removeCollection: StoreCtx["removeCollection"] = useCallback((id) => {
    setLocal((s) => ({ ...s, collections: s.collections.filter((c) => c.id !== id) }));
  }, []);

  // ---- Talent mappings: DB-backed via server fns ----
  const fetchMappings = useServerFn(listTalentMappings);
  const upsertMappingFn = useServerFn(upsertTalentMappingFn);
  const removeMappingFn = useServerFn(removeTalentMappingFn);
  const addEvidenceFn = useServerFn(addTalentEvidenceFn);
  const removeEvidenceFn = useServerFn(removeTalentEvidenceFn);

  const { data: mappingsData } = useQuery({
    queryKey: ["talent-mappings", "all"],
    queryFn: async () => {
      try {
        return await fetchMappings();
      } catch {
        return { items: [] as TalentMapping[] };
      }
    },
    staleTime: 30_000,
  });
  const talentMappings: TalentMapping[] = useMemo(
    () => ((mappingsData?.items ?? []) as TalentMapping[]),
    [mappingsData],
  );

  const invalidateMappings = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["talent-mappings"] });
  }, [qc]);

  const upsertTalentMapping: StoreCtx["upsertTalentMapping"] = useCallback(
    (personId, assetId, role) => {
      const now = new Date().toISOString();
      const existing = talentMappings.find((m) => m.personId === personId && m.assetId === assetId);
      const optimistic: TalentMapping = existing
        ? { ...existing, role, updatedAt: now }
        : { id: uid("tm"), personId, assetId, role, evidence: [], createdAt: now, updatedAt: now };
      // Optimistic cache update
      qc.setQueryData(["talent-mappings", "all"], (prev: { items: TalentMapping[] } | undefined) => {
        const items = prev?.items ?? [];
        const next = existing
          ? items.map((m) => (m.id === existing.id ? optimistic : m))
          : [optimistic, ...items];
        return { items: next };
      });
      void (async () => {
        try {
          await upsertMappingFn({ data: { personId, assetId, role } });
          invalidateMappings();
        } catch (e) {
          console.error("[talent] upsert failed", e);
          invalidateMappings();
        }
      })();
      return optimistic;
    },
    [talentMappings, qc, upsertMappingFn, invalidateMappings],
  );

  const removeTalentMapping: StoreCtx["removeTalentMapping"] = useCallback(
    (id) => {
      qc.setQueryData(["talent-mappings", "all"], (prev: { items: TalentMapping[] } | undefined) =>
        prev ? { items: prev.items.filter((m) => m.id !== id) } : prev,
      );
      void (async () => {
        try {
          await removeMappingFn({ data: { id } });
          invalidateMappings();
        } catch (e) {
          console.error("[talent] remove failed", e);
          invalidateMappings();
        }
      })();
    },
    [qc, removeMappingFn, invalidateMappings],
  );

  const addTalentEvidence: StoreCtx["addTalentEvidence"] = useCallback(
    (mappingId, e) => {
      void (async () => {
        try {
          await addEvidenceFn({ data: { mappingId, evidence: e } });
          invalidateMappings();
        } catch (err) {
          console.error("[talent] addEvidence failed", err);
        }
      })();
    },
    [addEvidenceFn, invalidateMappings],
  );

  const removeTalentEvidence: StoreCtx["removeTalentEvidence"] = useCallback(
    (mappingId, evidenceId) => {
      void (async () => {
        try {
          await removeEvidenceFn({ data: { mappingId, evidenceId } });
          invalidateMappings();
        } catch (err) {
          console.error("[talent] removeEvidence failed", err);
        }
      })();
    },
    [removeEvidenceFn, invalidateMappings],
  );

  const value = useMemo<StoreCtx>(
    () => ({
      assets,
      translations,
      collections: local.collections,
      talentMappings,
      isLoading,
      audiences: seed.audiences,
      formats: seed.formats,
      tones: seed.tones,
      categoryLabels: seed.categoryLabels as Record<string, { th: string; en: string }>,
      typeLabels: seed.typeLabels as Record<string, { th: string; en: string }>,
      createAsset,
      updateAsset,
      removeAsset,
      getAsset: (id) => assets.find((a) => a.id === id),
      getAssetBySlug: (slug) => assets.find((a) => a.slug === slug),
      createTranslation,
      updateTranslation,
      removeTranslation,
      getTranslation: (id) => translations.find((t) => t.id === id),
      createCollection,
      updateCollection,
      removeCollection,
      upsertTalentMapping,
      removeTalentMapping,
      addTalentEvidence,
      removeTalentEvidence,
      slugify,
      reset: () => {
        if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
        setLocal({ collections: [] });
        invalidateAll();
      },
    }),
    [
      assets,
      translations,
      local,
      isLoading,
      talentMappings,
      createAsset,
      updateAsset,
      removeAsset,
      createTranslation,
      updateTranslation,
      removeTranslation,
      createCollection,
      updateCollection,
      removeCollection,
      upsertTalentMapping,
      removeTalentMapping,
      addTalentEvidence,
      removeTalentEvidence,
      invalidateAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductKnowledge() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProductKnowledge must be used inside ProductKnowledgeProvider");
  return ctx;
}
