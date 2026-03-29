"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { DashboardNavVisibility } from "@/lib/dashboard-nav-visibility";

const DashboardNavContext = createContext<DashboardNavVisibility | null>(null);

export function DashboardNavProvider({
  value,
  children,
}: {
  value: DashboardNavVisibility;
  children: ReactNode;
}) {
  return (
    <DashboardNavContext.Provider value={value}>
      {children}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNavVisibility(): DashboardNavVisibility {
  const v = useContext(DashboardNavContext);
  if (!v) {
    throw new Error("useDashboardNavVisibility deve estar dentro de DashboardNavProvider");
  }
  return v;
}
