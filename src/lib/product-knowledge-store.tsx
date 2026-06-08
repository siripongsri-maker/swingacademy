import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import seed from "@/data/product-knowledge-seed.json";

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
  status: TranslationStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type StoreState = {
  assets: KnowledgeAsset[];
  translations: KnowledgeTranslation[];
};

type CreateAssetInput = Omit<
  KnowledgeAsset,
  "id" | "slug" | "createdAt" | "updatedAt" | "versionHistory"
> & { slug?: string };

type StoreCtx = StoreState & {
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
  slugify: (input: string) => string;
  reset: () => void;
};

const Ctx = createContext<StoreCtx | null>(null);
const LS_KEY = "swing.product-knowledge.v2";

function loadInitial(): StoreState {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as StoreState;
    } catch {
      /* ignore */
    }
  }
  return { assets: [], translations: [] };
}

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

function ensureUniqueSlug(slug: string, assets: KnowledgeAsset[], ignoreId?: string): string {
  let candidate = slug;
  let i = 2;
  const taken = new Set(assets.filter((a) => a.id !== ignoreId).map((a) => a.slug));
  while (taken.has(candidate)) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}

export function ProductKnowledgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(() => ({ assets: [], translations: [] }));

  useEffect(() => {
    setState(loadInitial());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const createAsset: StoreCtx["createAsset"] = useCallback((a) => {
    const now = new Date().toISOString();
    let created!: KnowledgeAsset;
    setState((s) => {
      const baseSlug = slugify(a.slug || a.titleEn || a.titleTh || "knowledge");
      const slug = ensureUniqueSlug(baseSlug, s.assets);
      created = {
        ...a,
        slug,
        id: uid("pk"),
        createdAt: now,
        updatedAt: now,
        versionHistory: [{ v: "1.0", at: now, by: "You", note: "Created" }],
      };
      return { ...s, assets: [created, ...s.assets] };
    });
    return created;
  }, []);

  const updateAsset: StoreCtx["updateAsset"] = useCallback((id, patch, note) => {
    setState((s) => ({
      ...s,
      assets: s.assets.map((a) => {
        if (a.id !== id) return a;
        const now = new Date().toISOString();
        const lastV = parseFloat(a.versionHistory.at(-1)?.v ?? "1.0");
        const nextV = (lastV + 0.1).toFixed(1);
        let nextSlug = a.slug;
        if (patch.slug && patch.slug !== a.slug) {
          nextSlug = ensureUniqueSlug(slugify(patch.slug), s.assets, a.id);
        }
        return {
          ...a,
          ...patch,
          slug: nextSlug,
          updatedAt: now,
          versionHistory: note
            ? [...a.versionHistory, { v: nextV, at: now, by: "You", note }]
            : a.versionHistory,
        };
      }),
    }));
  }, []);

  const removeAsset: StoreCtx["removeAsset"] = useCallback((id) => {
    setState((s) => ({ ...s, assets: s.assets.filter((a) => a.id !== id) }));
  }, []);

  const createTranslation: StoreCtx["createTranslation"] = useCallback((t) => {
    const now = new Date().toISOString();
    const tr: KnowledgeTranslation = { ...t, id: uid("kt"), createdAt: now, updatedAt: now };
    setState((s) => ({ ...s, translations: [tr, ...s.translations] }));
    return tr;
  }, []);

  const updateTranslation: StoreCtx["updateTranslation"] = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      translations: s.translations.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    }));
  }, []);

  const removeTranslation: StoreCtx["removeTranslation"] = useCallback((id) => {
    setState((s) => ({ ...s, translations: s.translations.filter((t) => t.id !== id) }));
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      ...state,
      audiences: seed.audiences,
      formats: seed.formats,
      tones: seed.tones,
      categoryLabels: seed.categoryLabels as Record<string, { th: string; en: string }>,
      typeLabels: seed.typeLabels as Record<string, { th: string; en: string }>,
      createAsset,
      updateAsset,
      removeAsset,
      getAsset: (id) => state.assets.find((a) => a.id === id),
      getAssetBySlug: (slug) => state.assets.find((a) => a.slug === slug),
      createTranslation,
      updateTranslation,
      removeTranslation,
      getTranslation: (id) => state.translations.find((t) => t.id === id),
      slugify,
      reset: () => {
        if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
        setState({ assets: [], translations: [] });
      },
    }),
    [state, createAsset, updateAsset, removeAsset, createTranslation, updateTranslation, removeTranslation],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductKnowledge() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProductKnowledge must be used inside ProductKnowledgeProvider");
  return ctx;
}
