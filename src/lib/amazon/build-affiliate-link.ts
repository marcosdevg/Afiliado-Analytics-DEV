import { extractAsinFromUrl } from "./extract-asin";

/**
 * Monta um link de afiliado Amazon a partir de uma URL de produto + tag do
 * usuário (ex.: `meutag-20`).
 *
 * O programa Amazon Associates aceita o parâmetro `?tag=USERTAG-20` em
 * qualquer URL canônica (`/dp/ASIN`). Mantemos a URL no domínio original
 * (não fazemos shorten via amzn.to porque isso exige uso da extensão/painel
 * de afiliados — pode ser plugado depois substituindo esta função).
 *
 * Retorna `null` se a URL não tem ASIN reconhecível.
 */
export type AmazonAffiliateLinkInput = {
  productPageUrl: string;
  affiliateTag: string;
  /** Domínio Amazon a usar na URL canônica. Default: amazon.com.br */
  domain?: string;
};

export function buildAmazonAffiliateShortLink(input: AmazonAffiliateLinkInput): {
  shortLink: string;
  asin: string;
} | null {
  const asin = extractAsinFromUrl(input.productPageUrl);
  if (!asin) return null;
  const tag = input.affiliateTag.trim();
  if (!tag) return null;
  const domain = (input.domain ?? "amazon.com.br").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // URL canônica curta + tag de associate. A Amazon redireciona normalmente
  // mantendo a tag no cookie de atribuição.
  const shortLink = `https://www.${domain}/dp/${asin}?tag=${encodeURIComponent(tag)}`;
  return { shortLink, asin };
}
