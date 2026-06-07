import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import seed from "@/data/seed-data.json";
import type { Localized } from "./language-context";

type Learner = {
  id: string;
  initial: string;
  name: Localized;
  role: Localized;
  site: Localized;
  joined: string;
};

export type Certificate = {
  code: string;
  courseId: string;
  holder: Localized;
  issued: string;
  expires: string;
  status: string;
};

type AccountState = {
  signedIn: boolean;
  learner: Learner;
  enrolled: string[];
  saved: string[];
  certificates: Certificate[];
  progress: Record<string, number>;
};

type AccountContextValue = AccountState & {
  signIn: () => void;
  signOut: () => void;
  toggleSaved: (id: string) => void;
  enroll: (id: string) => void;
  setProgress: (id: string, pct: number) => void;
};

const STORAGE_KEY = "swing-academy-account";

const learner = seed.publicPortal.learner as Learner;
const seedCerts = seed.publicPortal.publicCertificates as Certificate[];

const initial: AccountState = {
  signedIn: false,
  learner,
  enrolled: [],
  saved: [],
  certificates: [],
  progress: {},
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: AccountState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const signIn = () => {
    const enrolled = seed.publicPortal.seedEnrolled as string[];
    const saved = seed.publicPortal.seedSaved as string[];
    const certificates = seedCerts.filter((c) => c.holder.en === learner.name.en);
    const progress: Record<string, number> = {};
    enrolled.forEach((id, i) => {
      progress[id] = [25, 60, 100, 40, 80][i % 5];
    });
    persist({
      signedIn: true,
      learner,
      enrolled,
      saved,
      certificates,
      progress,
    });
  };

  const signOut = () => persist(initial);

  const toggleSaved = (id: string) =>
    persist({
      ...state,
      saved: state.saved.includes(id)
        ? state.saved.filter((s) => s !== id)
        : [...state.saved, id],
    });

  const enroll = (id: string) =>
    persist({
      ...state,
      enrolled: state.enrolled.includes(id) ? state.enrolled : [...state.enrolled, id],
      progress: { ...state.progress, [id]: state.progress[id] ?? 0 },
    });

  const setProgress = (id: string, pct: number) =>
    persist({ ...state, progress: { ...state.progress, [id]: pct } });

  return (
    <AccountContext.Provider value={{ ...state, signIn, signOut, toggleSaved, enroll, setProgress }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
