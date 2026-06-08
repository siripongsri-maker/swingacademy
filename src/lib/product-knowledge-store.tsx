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
  | "curriculum"
  | "sop"
  | "toolkit"
  | "campaign"
  | "health_product"
  | "service_guide"
  | "partner_resource"
  | "research_summary";

export type KnowledgeStatus = "draft" | "published" | "archived";
export type Language = "th" | "en" | "bilingual";
export type Attachment = {
  id: string;
  kind: "pdf" | "slides" | "image" | "video_url";
  title?: string;
  externalUrl?: string;
};
export type VersionEntry = { v: string; at: string; by: string; note: string };

export type KnowledgeAsset = {
  id: string;
  titleTh: string;
  titleEn: string;
  type: KnowledgeType;
  categories: string[];
  productService: string;
  audiences: string[];
  keyMessage: string;
  contentMd: string;
  source: string;
  tags: string[];
  language: Language;
  status: KnowledgeStatus;
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

type StoreCtx = StoreState & {
  audiences: Array<{ id: string; th: string; en: string }>;
  formats: Array<{ id: string; th: string; en: string }>;
  tones: Array<{ id: string; th: string; en: string }>;
  categoryLabels: Record<string, { th: string; en: string }>;
  typeLabels: Record<string, { th: string; en: string }>;
  createAsset: (a: Omit<KnowledgeAsset, "id" | "createdAt" | "updatedAt" | "versionHistory">) => KnowledgeAsset;
  updateAsset: (id: string, patch: Partial<KnowledgeAsset>, note?: string) => void;
  removeAsset: (id: string) => void;
  getAsset: (id: string) => KnowledgeAsset | undefined;
  createTranslation: (t: Omit<KnowledgeTranslation, "id" | "createdAt" | "updatedAt">) => KnowledgeTranslation;
  updateTranslation: (id: string, patch: Partial<KnowledgeTranslation>) => void;
  removeTranslation: (id: string) => void;
  getTranslation: (id: string) => KnowledgeTranslation | undefined;
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
    const asset: KnowledgeAsset = {
      ...a,
      id: uid("pk"),
      createdAt: now,
      updatedAt: now,
      versionHistory: [{ v: "1.0", at: now, by: "You", note: "Created" }],
    };
    setState((s) => ({ ...s, assets: [asset, ...s.assets] }));
    return asset;
  }, []);

  const updateAsset: StoreCtx["updateAsset"] = useCallback((id, patch, note) => {
    setState((s) => ({
      ...s,
      assets: s.assets.map((a) => {
        if (a.id !== id) return a;
        const now = new Date().toISOString();
        const lastV = parseFloat(a.versionHistory.at(-1)?.v ?? "1.0");
        const nextV = (lastV + 0.1).toFixed(1);
        return {
          ...a,
          ...patch,
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
      createTranslation,
      updateTranslation,
      removeTranslation,
      getTranslation: (id) => state.translations.find((t) => t.id === id),
      reset: () => {
        if (typeof window !== "undefined") window.localStorage.removeItem(LS_KEY);
        setState({
          assets: seed.assets as KnowledgeAsset[],
          translations: seed.translations as KnowledgeTranslation[],
        });
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
