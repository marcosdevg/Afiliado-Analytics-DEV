/**
 * Regras de negócio do ATI: classificação de métricas e status do criativo
 */

import { ATI_THRESHOLDS } from "./types";
import type { MetricLevel, CreativeStatus } from "./types";

function levelCpcMeta(cpc: number): MetricLevel {
  if (cpc < ATI_THRESHOLDS.cpcMeta.excellent) return "excellent";
  if (cpc <= ATI_THRESHOLDS.cpcMeta.goodMax) return "good";
  return "bad";
}

function levelClickDiscrepancy(pct: number): MetricLevel {
  if (pct <= ATI_THRESHOLDS.clickDiscrepancy.excellent) return "excellent";
  if (pct <= ATI_THRESHOLDS.clickDiscrepancy.goodMax) return "good";
  return "bad";
}

function levelCpa(cpa: number): MetricLevel {
  if (cpa <= ATI_THRESHOLDS.cpa.excellent) return "excellent";
  if (cpa <= ATI_THRESHOLDS.cpa.goodMax) return "good";
  return "bad";
}

function levelRoas(roas: number): MetricLevel {
  if (roas >= ATI_THRESHOLDS.roas.excellent) return "excellent";
  if (roas >= ATI_THRESHOLDS.roas.goodMin && roas <= ATI_THRESHOLDS.roas.goodMax) return "good";
  return "bad";
}

export function getLevelCpcMeta(cpc: number): MetricLevel {
  return levelCpcMeta(cpc);
}

export function getLevelClickDiscrepancy(pct: number): MetricLevel {
  return levelClickDiscrepancy(pct);
}

export function getLevelCpa(cpa: number): MetricLevel {
  return levelCpa(cpa);
}

export function getLevelRoas(roas: number): MetricLevel {
  return levelRoas(roas);
}

/**
 * Status principal do criativo (Fase de Teste).
 * Regras:
 * - Pending: sem entrega ainda (custo e cliques zerados) → não avaliar
 * - Excelente: ROAS >= 2.5 (ou ROAS > 4.0 mesmo com CPC amarelo)
 * - Ruim: ROAS < 1.3 OU Dif. Cliques > 40% OU CPC > 0.25
 * - Bom: o resto
 */
export function getCreativeStatus(
  roas: number,
  cpcMeta: number,
  clickDiscrepancyPct: number,
  cpa: number,
  hasActivity: boolean
): CreativeStatus {
  if (!hasActivity) return "pending";

  // Exceção de Ouro: ROAS > 4.0 → Excelente mesmo com CPC amarelo
  if (roas >= ATI_THRESHOLDS.creativeExceptionRoas) return "excellent";

  // Excelente: ROAS >= 2.5 e CPA <= 1.50 (ou margem segura)
  if (roas >= ATI_THRESHOLDS.creativeExcellentRoas && cpa <= ATI_THRESHOLDS.cpa.excellent)
    return "excellent";

  // Ruim
  if (roas < ATI_THRESHOLDS.creativeBadRoas) return "bad";
  if (clickDiscrepancyPct >= ATI_THRESHOLDS.creativeBadClickDiff) return "bad";
  if (cpcMeta >= ATI_THRESHOLDS.creativeBadCpc) return "bad";

  return "good";
}

/**
 * Gera diagnóstico de apoio conforme conflitos de métricas
 */
export function getCreativeDiagnosis(
  status: CreativeStatus,
  roas: number,
  cpcMeta: number,
  levelCpc: MetricLevel,
  clickDiscrepancyPct: number,
  levelClick: MetricLevel,
  orders: number
): string {
  if (status === "pending") {
    return "Anúncio sem entrega no período. Ative e aguarde dados para ver a avaliação.";
  }

  if (status === "excellent") {
    if (levelCpc === "good" || levelCpc === "bad")
      return "Apesar do clique estar caro, sua conversão está altíssima. Pode escalar!";
    return "Criativo vencedor. Margem segura para escalar orçamento.";
  }

  if (status === "bad") {
    if (levelClick === "bad" && roas < ATI_THRESHOLDS.creativeBadRoas)
      return "O criativo atrai cliques baratos, mas as pessoas não estão comprando! Ajuste o criativo.";
    if (orders === 0 && roas === 0)
      return "O criativo é bom em cliques, mas a oferta/produto não está convertendo. Teste outro produto.";
    if (roas < ATI_THRESHOLDS.creativeBadRoas)
      return "Retorno abaixo do investimento. Pause ou ajuste o criativo.";
    if (clickDiscrepancyPct >= ATI_THRESHOLDS.creativeBadClickDiff)
      return "Muita perda de cliques entre Meta e Shopee. Verifique o link e a velocidade do carregamento.";
    if (cpcMeta >= ATI_THRESHOLDS.creativeBadCpc)
      return "Custo por clique muito alto para o padrão Shopee. Dificulta fechar com lucro.";
    return "Métricas indicam risco de prejuízo. Ajuste ou pause.";
  }

  // good
  return "Campanha se pagando. Pode manter e testar ajustes para melhorar ROAS.";
}

export function canValidateCreative(status: CreativeStatus): boolean {
  return status === "excellent" || status === "good";
}
