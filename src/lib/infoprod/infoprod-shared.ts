/**
 * Helpers compartilhados do Infoprodutor (sem dependência de gateway de
 * pagamento). Funções genéricas: formatação de endereço do remetente, montar
 * URL de WhatsApp, e os nomes canônicos das opções de entrega.
 */

export type DeliveryMode = {
  allowShipping: boolean;
  allowPickup: boolean;
  allowDigital?: boolean;
  allowLocalDelivery?: boolean;
};

export type SenderSnapshot = {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
};

export const SHIPPING_RATE_DISPLAY_NAMES = {
  shipping: "Correios",
  pickup: "Retirar na loja",
} as const;

/** Converte telefone/whatsapp livre em URL wa.me (55 + DDD + número). */
export function toWhatsAppUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

/** Endereço curto do remetente pra exibir no checkout (modo retirada). */
export function formatSenderAddressShort(s: SenderSnapshot | null): string {
  if (!s) return "";
  const streetPart = [s.street, s.number ? `nº ${s.number}` : null, s.complement].filter(Boolean).join(" ");
  const city = [s.city, s.uf].filter(Boolean).join("/");
  return [streetPart, s.neighborhood, city].filter(Boolean).join(", ");
}
