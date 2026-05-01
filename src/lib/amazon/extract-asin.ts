/**
 * Extrai ASIN (Amazon Standard Identification Number) de uma URL Amazon.
 *
 * Formatos suportados (todos amazon.com / amazon.com.br / amzn.to):
 *   - https://www.amazon.com.br/dp/B0XXXXXXXX
 *   - https://www.amazon.com.br/gp/product/B0XXXXXXXX
 *   - https://www.amazon.com.br/Some-Product-Name/dp/B0XXXXXXXX/...
 *   - https://amzn.to/3xyzabc           → encurtado, não dá pra extrair sem follow redirect
 *   - asin=B0XXXXXXXX                    → query param
 *
 * ASINs Amazon têm 10 caracteres alfanuméricos. ISBNs (livros) também são 10
 * dígitos numéricos e a Amazon aceita como ASIN, então tolera dígitos puros.
 */
export function extractAsinFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let blob = trimmed;
  if (trimmed.includes("://")) {
    try {
      const u = new URL(trimmed);
      blob = `${u.pathname}${u.search}${u.hash}`;
      const asinParam = u.searchParams.get("asin");
      if (asinParam && /^[A-Z0-9]{10}$/i.test(asinParam)) {
        return asinParam.toUpperCase();
      }
    } catch {
      blob = trimmed;
    }
  }

  const dpMatch = blob.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dpMatch) return dpMatch[1].toUpperCase();

  const gpMatch = blob.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (gpMatch) return gpMatch[1].toUpperCase();

  const productMatch = blob.match(/\/product\/([A-Z0-9]{10})/i);
  if (productMatch) return productMatch[1].toUpperCase();

  return null;
}

/** True se o host parece Amazon (qualquer região) ou amzn.to encurtado. */
export function looksLikeAmazonProductUrl(url: string): boolean {
  const t = url.trim().toLowerCase();
  if (!t.startsWith("http")) return false;
  try {
    const h = new URL(t).hostname;
    return (
      h === "amazon.com" ||
      h === "amazon.com.br" ||
      h.endsWith(".amazon.com") ||
      h.endsWith(".amazon.com.br") ||
      h === "amzn.to" ||
      h.endsWith(".amzn.to") ||
      h === "a.co"
    );
  } catch {
    return false;
  }
}
