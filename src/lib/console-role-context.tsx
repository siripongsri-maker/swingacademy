import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type ConsoleRole,
  type Capability,
  can as canFor,
  canEditAsset as canEditAssetFor,
  canTranslateAsset as canTranslateAssetFor,
  highestRole,
} from "@/lib/permissions";

type Ctx = {
  role: ConsoleRole;
  setRole: (r: ConsoleRole) => void;
  isDemo: boolean; // true when role is overridden client-side (no real session)
  can: (cap: Capability) => boolean;
  canEditAsset: (a: { ownerId?: string | null }) => boolean;
  canTranslateAsset: (a: { ownerId?: string | null; status?: string }) => boolean;
  currentUserId: string;
};

const STORAGE_KEY = "swing.console.role";
const DEMO_USER_ID = "current-user";

const Ctx = createContext<Ctx | null>(null);

export function ConsoleRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ConsoleRole>("admin"); // default to admin for prototype
  const [isDemo] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as ConsoleRole | null;
    if (stored === "staff" || stored === "trainer" || stored === "admin") setRoleState(stored);
  }, []);

  const setRole = (r: ConsoleRole) => {
    setRoleState(r);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, r);
  };

  const value = useMemo<Ctx>(
    () => ({
      role,
      setRole,
      isDemo,
      currentUserId: DEMO_USER_ID,
      can: (cap) => canFor(role, cap),
      canEditAsset: (a) => canEditAssetFor(role, { ownerId: a.ownerId ?? null, currentUserId: DEMO_USER_ID }),
      canTranslateAsset: (a) =>
        canTranslateAssetFor(role, {
          ownerId: a.ownerId ?? null,
          currentUserId: DEMO_USER_ID,
          status: a.status,
        }),
    }),
    [role, isDemo],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsoleRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsoleRole must be used inside <ConsoleRoleProvider>");
  return ctx;
}

export { highestRole };
