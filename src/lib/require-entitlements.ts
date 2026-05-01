/**
 * Gate helpers para API routes.
 * Retornam NextResponse 403 se a feature não está liberada para o plano do user.
 *
 * Cada feature aponta pro tier mínimo onde está disponível, e a mensagem do
 * 403 muda em função disso ("Padrão ou Pro" vs "apenas Pro").
 */

import { NextResponse } from "next/server";
import { createClient } from "../../utils/supabase/server";
import { getEntitlementsForUser } from "./plan-server";

type GateResult = { allowed: true; userId: string } | { allowed: false; response: NextResponse };

/** Features que existem como `boolean` em PlanEntitlements e podem ser portadas pra um gate genérico. */
type GateableFeature =
  | "ati"
  | "criarCampanhaMeta"
  | "geradorCriativos"
  | "espelhamentogrupos"
  | "especialistagenerate"
  | "infoprodutor"
  | "tendenciasShopee"
  | "analiseOfertasRelampago"
  | "mercadoLivre"
  | "amazon";

/**
 * Tier mínimo onde cada feature está disponível.
 * Usado pra montar a copy do 403 ("Padrão ou Pro" vs "apenas Pro").
 */
const FEATURE_MIN_TIER: Record<GateableFeature, "padrao" | "pro"> = {
  ati: "padrao",
  criarCampanhaMeta: "padrao",
  espelhamentogrupos: "padrao",
  infoprodutor: "padrao",
  tendenciasShopee: "padrao",
  analiseOfertasRelampago: "padrao",
  mercadoLivre: "padrao",
  amazon: "padrao",
  geradorCriativos: "pro",
  especialistagenerate: "pro",
};

function gateErrorMessage(feature: GateableFeature): string {
  const minTier = FEATURE_MIN_TIER[feature];
  return minTier === "pro"
    ? "Recurso disponível apenas no Plano Pro. Faça upgrade para acessar."
    : "Recurso disponível nos Planos Padrão e Pro. Faça upgrade para acessar.";
}

async function gateFeature(feature: GateableFeature): Promise<GateResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { allowed: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  const ent = await getEntitlementsForUser(supabase, user.id);
  if (!ent[feature]) {
    return {
      allowed: false,
      response: NextResponse.json({ error: gateErrorMessage(feature) }, { status: 403 }),
    };
  }
  return { allowed: true, userId: user.id };
}

export async function gateAti(): Promise<GateResult> {
  return gateFeature("ati");
}

export async function gateCriarCampanhaMeta(): Promise<GateResult> {
  return gateFeature("criarCampanhaMeta");
}

export async function gateGeradorCriativos(): Promise<GateResult> {
  return gateFeature("geradorCriativos");
}

export async function gateEspelhamentoGrupos(): Promise<GateResult> {
  return gateFeature("espelhamentogrupos");
}

export async function gateEspecialistaGenerate(): Promise<GateResult> {
  return gateFeature("especialistagenerate");
}

export async function gateInfoprodutor(): Promise<GateResult> {
  return gateFeature("infoprodutor");
}

export async function gateTendenciasShopee(): Promise<GateResult> {
  return gateFeature("tendenciasShopee");
}

export async function gateAnaliseOfertasRelampago(): Promise<GateResult> {
  return gateFeature("analiseOfertasRelampago");
}

export async function gateMercadoLivre(): Promise<GateResult> {
  return gateFeature("mercadoLivre");
}

export async function gateAmazon(): Promise<GateResult> {
  return gateFeature("amazon");
}
