/**
 * Limites e flags por tier de plano.
 * `legacy` = mesmo comportamento que `padrao` (usuários antigos não ganham “tudo ilimitado”).
 */

export type PlanTier = "legacy" | "padrao" | "pro" | "staff" | "trial";

export type GruposVendaLimits = {
  /** Campanhas ativas no máximo */
  maxActiveCampaigns: number;
  /** Máximo de listas de grupos (null = sem teto além do total de grupos) */
  maxLists: number | null;
  /** Teto total de grupos somando todas as listas */
  maxGroupsTotal: number;
};

export type GplUiLimits = {
  /** Calculadora GPL acessível */
  enabled: boolean;
  /** Cards de resumo (summary) visíveis */
  showSummaryCards: boolean;
  /** Bloco grupos/campanhas/instância visível */
  showGroupsCampaignsInstance: boolean;
};

export type PlanEntitlements = {
  analiseComissoes: boolean;
  analiseCliques: boolean;
  meusLinks: boolean;
  /**
   * Máximo de sites de captura gravados em `capture_sites` para o usuário.
   * Valor > 1 (ex.: pro/staff) exige no Postgres **sem** UNIQUE só em `userid`;
   * ver migration `20250325_capture_sites_multiple_per_user.sql`.
   */
  captureLinks: number;
  gpl: GplUiLimits;
  geradorLinksShopee: boolean;
  gruposVenda: GruposVendaLimits;
  /** Instâncias Evolution / WhatsApp */
  evolutionInstances: number;
  ati: boolean;
  criarCampanhaMeta: boolean;
  geradorCriativos: boolean;
  /** null = sem limite diário (feature desligada ou ilimitado) */
  videoExportsPerDay: number | null;
  /** Limite diário de gerações "voz + legendas" (ElevenLabs with-timestamps). */
  voicegenerate: number | null;
  /** Limite diário de «Gerar copy com IA» (Grok) antes de cobrar coins. */
  videoEditorCopyPerDay: number;
  espelhamentogrupos: boolean;
  especialistagenerate: boolean;
  /** Infoprodutor: catálogo Mercado Pago + checkout dinâmico (frete) — liberado pra padrao/pro/staff, bloqueado em trial. */
  infoprodutor: boolean;
};



const PADRAO_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 1,
  gpl: {
    enabled: true,
    showSummaryCards: false,
    showGroupsCampaignsInstance: false,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 5,
    maxLists: null,
    maxGroupsTotal: 5,
  },
  evolutionInstances: 2,
  ati: false,
  criarCampanhaMeta: false,
  geradorCriativos: false,
  videoExportsPerDay: null,
  voicegenerate: 0,
  videoEditorCopyPerDay: 0,
  espelhamentogrupos: false,
  especialistagenerate: false,
  infoprodutor: true,
} as const satisfies PlanEntitlements;

/** Trial por cupom: só comissões, cliques, redirecionador, gerador Shopee e 1 captura. */
const TRIAL_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 1,
  gpl: {
    enabled: false,
    showSummaryCards: false,
    showGroupsCampaignsInstance: false,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 0,
    maxLists: null,
    maxGroupsTotal: 0,
  },
  evolutionInstances: 0,
  ati: false,
  criarCampanhaMeta: false,
  geradorCriativos: false,
  videoExportsPerDay: null,
  voicegenerate: 0,
  videoEditorCopyPerDay: 0,
  espelhamentogrupos: false,
  especialistagenerate: false,
  infoprodutor: false,
} as const satisfies PlanEntitlements;

const PRO_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 5,
  gpl: {
    enabled: true,
    showSummaryCards: true,
    showGroupsCampaignsInstance: true,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 200,
    maxLists: null,
    maxGroupsTotal: 200,
  },
  evolutionInstances: 5,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: true,
  videoExportsPerDay: 2,
  voicegenerate: 2,
  videoEditorCopyPerDay: 2,
  espelhamentogrupos: true,
  especialistagenerate: true,
  infoprodutor: true,
} as const satisfies PlanEntitlements;



const STAFF_LIMITS = {
  analiseComissoes: true,
  analiseCliques: true,
  meusLinks: true,
  captureLinks: 5,
  gpl: {
    enabled: true,
    showSummaryCards: true,
    showGroupsCampaignsInstance: true,
  },
  geradorLinksShopee: true,
  gruposVenda: {
    maxActiveCampaigns: 20,
    maxLists: null,
    maxGroupsTotal: 20,
  },
  evolutionInstances: 10,
  ati: true,
  criarCampanhaMeta: true,
  geradorCriativos: true,
  videoExportsPerDay: 2,
  voicegenerate: 2,
  videoEditorCopyPerDay: 2,
  espelhamentogrupos: true,
  especialistagenerate: true,
  infoprodutor: true,
} as const satisfies PlanEntitlements;

/** Mesma referência para legacy e padrao — alterar um não altera o outro em runtime se você clonar; aqui são iguais por definição. */
export const LIMITS: Record<PlanTier, PlanEntitlements> = {
  legacy: { ...PADRAO_LIMITS, gpl: { ...PADRAO_LIMITS.gpl }, gruposVenda: { ...PADRAO_LIMITS.gruposVenda } },
  padrao: { ...PADRAO_LIMITS, gpl: { ...PADRAO_LIMITS.gpl }, gruposVenda: { ...PADRAO_LIMITS.gruposVenda } },
  pro: { ...PRO_LIMITS, gpl: { ...PRO_LIMITS.gpl }, gruposVenda: { ...PRO_LIMITS.gruposVenda } },
  staff: { ...STAFF_LIMITS, gpl: { ...STAFF_LIMITS.gpl }, gruposVenda: { ...STAFF_LIMITS.gruposVenda } },
  trial: { ...TRIAL_LIMITS, gpl: { ...TRIAL_LIMITS.gpl }, gruposVenda: { ...TRIAL_LIMITS.gruposVenda } },
};

export function getEntitlementsForTier(tier: PlanTier | string | null | undefined): PlanEntitlements {
  if (tier === "pro") return LIMITS.pro;
  if (tier === "staff") return LIMITS.staff;
  if (tier === "trial") return LIMITS.trial;
  if (tier === "padrao" || tier === "legacy") return LIMITS.padrao;
  // fallback seguro até existir plan_tier no profile
  return LIMITS.legacy;
}
