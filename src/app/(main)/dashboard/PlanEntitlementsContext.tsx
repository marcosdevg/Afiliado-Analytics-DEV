"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PlanEntitlements, PlanTier } from "@/lib/plan-entitlements";
import type { PlanUsageSnapshot } from "@/lib/plan-server";

type PlanCtx = {
  tier: PlanTier;
  entitlements: PlanEntitlements | null;
  usage: PlanUsageSnapshot | null;
  loading: boolean;
  refresh: () => void;
};

const Ctx = createContext<PlanCtx>({
  tier: "padrao",
  entitlements: null,
  usage: null,
  loading: true,
  refresh: () => {},
});

export function PlanEntitlementsProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<PlanTier>("padrao");
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);
  const [usage, setUsage] = useState<PlanUsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setTier(data.tier ?? "padrao");
        setEntitlements(data.entitlements ?? null);
        setUsage(data.usage ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return (
    <Ctx.Provider value={{ tier, entitlements, usage, loading, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlanEntitlements() {
  return useContext(Ctx);
}
