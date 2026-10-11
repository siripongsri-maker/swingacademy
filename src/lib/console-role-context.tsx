import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type ConsoleRole,
  type Capability,
  can as canFor,
  canEditAsset as canEditAssetFor,
  canTranslateAsset as canTranslateAssetFor,
  highestRole,
} from "@/lib/permissions";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles.functions";

/**
 * Result of the staff-console access check.
 * - loading: not checked yet (always the case during SSR, sessions are client-side)
 * - signed-out: no session, or the token was rejected by both the server and Supabase Auth
 * - denied: signed in, but no staff | trainer | admin | superadmin role
 * - error: the role lookup failed; fail closed until a retry succeeds
 * - ready: signed in with a staff-side role
 */
export type ConsoleAccess = "loading" | "signed-out" | "denied" | "error" | "ready";

type Ctx = {
  access: ConsoleAccess;
  /** Run the access check again (e.g. after a failed lookup). */
  recheck: () => void;
  /**
   * Console role of the signed-in user. Only meaningful when access is "ready":
   * StaffAccessGate keeps every consumer unmounted until then, so the type stays
   * ConsoleRole for them. Before that it is a lowest-privilege placeholder and
   * `can` / `canEditAsset` / `canTranslateAsset` all return false.
   */
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
  const [access, setAccess] = useState<ConsoleAccess>("loading");
  const [role, setRoleState] = useState<ConsoleRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const loadRef = useRef<() => void>(() => undefined);
  // User id whose staff role was last confirmed; lets a re-check that hits a
  // network error keep the open console instead of unmounting work in progress.
  const verifiedUserRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let seq = 0;

    const signOutState = () => {
      verifiedUserRef.current = null;
      setCurrentUserId("");
      setRoleState(null);
      setAccess("signed-out");
    };

    // /auth sends a live staff session straight back to /staff, so a server-side
    // "Unauthorized" only counts as signed out when Supabase Auth agrees.
    // Otherwise (e.g. the server could not verify the JWT) the two pages would
    // redirect to each other forever.
    const authAgreesSignedOut = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (data.user) return false;
        return !(error && isAuthRetryableFetchError(error));
      } catch {
        return false;
      }
    };

    const load = async () => {
      const mine = ++seq;
      const stale = () => cancelled || mine !== seq;
      let sessionUserId: string | null = null;
      try {
        // Local session read; the token itself is verified server-side by getMyRoles.
        const { data, error } = await supabase.auth.getSession();
        if (stale()) return;
        // A failed refresh (e.g. offline) is not a sign-out: Supabase keeps the
        // session, and emits SIGNED_OUT itself when the refresh token is dead.
        if (error) throw error;
        sessionUserId = data.session?.user.id ?? null;
        if (!sessionUserId) {
          signOutState();
          return;
        }
        const res = await getMyRoles();
        if (stale()) return;
        const next = highestRole(res.roles);
        verifiedUserRef.current = next ? res.userId : null;
        setCurrentUserId(res.userId);
        setRoleState(next);
        setAccess(next ? "ready" : "denied");
      } catch (e) {
        if (stale()) return;
        const message = e instanceof Error ? e.message : "";
        if (message.startsWith("Unauthorized")) {
          const signedOut = await authAgreesSignedOut();
          if (stale()) return;
          if (signedOut) {
            // Expired or revoked session: treat as signed out.
            signOutState();
            return;
          }
        }
        const verified = verifiedUserRef.current;
        if (verified && (sessionUserId === null || sessionUserId === verified)) {
          // Same user was already verified: keep the console open on a transient failure.
          setAccess("ready");
          return;
        }
        verifiedUserRef.current = null;
        setRoleState(null);
        setAccess("error");
      }
    };

    loadRef.current = () => void load();
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load();
      }
    });
    return () => {
      cancelled = true;
      loadRef.current = () => undefined;
      sub.subscription.unsubscribe();
    };
  }, []);

  const recheck = useCallback(() => {
    setAccess("loading");
    loadRef.current();
  }, []);

  const value = useMemo<Ctx>(() => {
    // No staff role (or not checked yet) means no capabilities at all.
    const effective = access === "ready" ? role : null;
    return {
      access,
      recheck,
      role: effective ?? "staff",
      setRole: () => {
        /* role is derived from account; no-op */
      },
      isDemo: false,
      currentUserId,
      can: (cap) => (effective ? canFor(effective, cap) : false),
      canEditAsset: (a) =>
        effective
          ? canEditAssetFor(effective, { ownerId: a.ownerId ?? null, currentUserId })
          : false,
      canTranslateAsset: (a) =>
        effective
          ? canTranslateAssetFor(effective, {
              ownerId: a.ownerId ?? null,
              currentUserId,
              status: a.status,
            })
          : false,
    };
  }, [access, recheck, role, currentUserId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsoleRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useConsoleRole must be used inside <ConsoleRoleProvider>");
  return ctx;
}

export { highestRole };
