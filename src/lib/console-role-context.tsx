import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type ConsoleRole,
  type Capability,
  can as canFor,
  canEditAsset as canEditAssetFor,
  canTranslateAsset as canTranslateAssetFor,
  highestRole,
} from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles.functions";

type Ctx = {
  role: ConsoleRole;
  setRole: (r: ConsoleRole) => void;
  isDemo: boolean;
  can: (cap: Capability) => boolean;
  canEditAsset: (a: { ownerId?: string | null }) => boolean;
  canTranslateAsset: (a: { ownerId?: string | null; status?: string }) => boolean;
  currentUserId: string;
};

const Ctx = createContext<Ctx | null>(null);

export function ConsoleRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ConsoleRole>("staff");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!data.user) {
          setCurrentUserId("");
          setRoleState("staff");
          return;
        }
        setCurrentUserId(data.user.id);
        const res = await getMyRoles();
        if (cancelled) return;
        setRoleState(highestRole(res.roles));
      } catch {
        if (!cancelled) setRoleState("staff");
      }
    };

    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      role,
      setRole: () => {
        /* role is derived from account; no-op */
      },
      isDemo: false,
      currentUserId,
      can: (cap) => canFor(role, cap),
      canEditAsset: (a) => canEditAssetFor(role, { ownerId: a.ownerId ?? null, currentUserId }),
      canTranslateAsset: (a) =>
        canTranslateAssetFor(role, {
          ownerId: a.ownerId ?? null,
          currentUserId,
          status: a.status,
        }),
    }),
    [role, currentUserId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsoleRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsoleRole must be used inside <ConsoleRoleProvider>");
  return ctx;
}

export { highestRole };
