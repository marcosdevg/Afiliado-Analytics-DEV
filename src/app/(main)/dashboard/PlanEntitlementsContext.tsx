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
  /** Mensal vs trimestral na assinatura Kiwify ativa (para modal de preços). */
  billingQuarterly: boolean | null;
  loading: boolean;
  refresh: () => void;
};

const Ctx = createContext<PlanCtx>({
  tier: "inicial",
  entitlements: null,
  usage: null,
  billingQuarterly: null,
  loading: true,
  refresh: () => {},
});

export function PlanEntitlementsProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<PlanTier>("inicial");
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);
  const [usage, setUsage] = useState<PlanUsageSnapshot | null>(null);
  const [billingQuarterly, setBillingQuarterly] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    // Só bloquear a UI no carregamento inicial. `refresh()` incrementa `tick` e não pode
    // disparar `loading` — senão o ProFeatureGate desmonta a página inteira (ex.: modal + coins).
    if (tick === 0) setLoading(true);
    fetch("/api/me/entitlements")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setTier(data.tier ?? "inicial");
        setEntitlements(data.entitlements ?? null);
        setUsage(data.usage ?? null);
        setBillingQuarterly(
          typeof data.billingQuarterly === "boolean"
            ? data.billingQuarterly
            : null
        );
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
    <Ctx.Provider
      value={{ tier, entitlements, usage, billingQuarterly, loading, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePlanEntitlements() {
  return useContext(Ctx);
}
