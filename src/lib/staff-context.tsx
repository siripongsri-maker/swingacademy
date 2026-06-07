import { createContext, useContext, useState, type ReactNode } from "react";

export type Drawer =
  | { kind: "asset"; id: string }
  | { kind: "product"; id: string }
  | { kind: "certificate"; id: string }
  | { kind: "export" }
  | null;

type StaffContextValue = {
  drawer: Drawer;
  openAsset: (id: string) => void;
  openProduct: (id: string) => void;
  openCertificate: (id: string) => void;
  openExport: () => void;
  close: () => void;
};

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState<Drawer>(null);

  const value: StaffContextValue = {
    drawer,
    openAsset: (id) => setDrawer({ kind: "asset", id }),
    openProduct: (id) => setDrawer({ kind: "product", id }),
    openCertificate: (id) => setDrawer({ kind: "certificate", id }),
    openExport: () => setDrawer({ kind: "export" }),
    close: () => setDrawer(null),
  };

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used within StaffProvider");
  return ctx;
}
