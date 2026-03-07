/**
 * Detecta se o User-Agent é de um bot/crawler
 * 
 * Usado em:
 * - Redirecionador (/api/r/[slug])
 * - Site de captura (/[slug])
 * - Página GO (/[slug]/go)
 * 
 * @param userAgent - String do User-Agent do request
 * @returns true se for bot, false se for usuário real
 */
export function detectBot(userAgent: string): boolean {
  // User-Agent vazio ou só espaços = bot
  if (!userAgent || userAgent.trim() === "") return true;

  const ua = userAgent.toLowerCase();

  // Meta/Facebook/Instagram crawlers (prefetch/preview)
  if (ua.includes("facebookexternalhit")) return true;
  if (ua.includes("meta-externalagent")) return true;
  if (ua.includes("meta-externalads")) return true;
  if (ua.includes("meta-externalfetcher")) return true;
  if (ua.includes("facebot")) return true;

  // WhatsApp preview crawler
  // Ex: "WhatsApp/2.23.20.0"
  if (ua.startsWith("whatsapp/")) return true;

  // Outros bots conhecidos (Googlebot, etc)
  if (/bot|crawler|spider|scraper|headless/i.test(userAgent)) return true;

  return false;
}
