"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Wallet, Lock, type LucideIcon } from "lucide-react";
import { UpgradePlanNotice } from "@/app/components/plan/UpgradePlanNotice";
import type { SubscriptionPlanTone } from "@/lib/plan-entitlements";
import ShopeeIntegrationCard from "./ShopeeIntegrationCard";
import MetaIntegrationCard from "./MetaIntegrationCard";
import MessagingChannelsCard from "./MessagingChannelsCard";
import MercadoLivreIntegrationCard from "./MercadoLivreIntegrationCard";
import AmazonIntegrationCard from "./AmazonIntegrationCard";
import MercadoPagoIntegrationCard from "./MercadoPagoIntegrationCard";
import ShippingProfileCard from "./ShippingProfileCard";
import NotificacoesCard from "./NotificacoesCard";
import { MERCADOLIVRE_UX_COMING_SOON } from "@/lib/mercadolivre-ux-coming-soon";

export type SectionKey =
  | "shopee"
  | "mercadolivre"
  | "amazon"
  | "meta"
  | "evolution"
  | "mercadopago"
  | "notificacoes"
  | null;

type ConfiguracoesClientProps = {
  initialAppId: string;
  initialHasKey: boolean;
  initialLast4: string | null;
  /** Abre o bloco Mercado Livre (ex.: link da Lista ML com ?ml=1). */
  initialOpenMl?: boolean;
  /** Credenciais opcionais da API de desenvolvedor (profiles). */
  initialMlClientId?: string;
  initialMlHasSecret?: boolean;
  initialMlSecretLast4?: string | null;
  metaHasToken: boolean;
  metaLast4: string | null;
  /** Cards Padrão+: ficam visíveis com cadeado pra Inicial (gatilho de venda). */
  canUseMercadoLivre: boolean;
  canUseAmazon: boolean;
  canUseMetaAds: boolean;
  canUseInfoprodutor: boolean;
  /** Para bloquear o cartão do plano atual no modal de preços (upgrade/downgrade nos demais). */
  currentPlanToneForPricing: SubscriptionPlanTone;
  /**
   * Se a assinatura ativa (mesmo tier) é trimestral. `null` = não inferido.
   * Usado com o toggle mensal/trimestral: bloqueia só o período que já contratou.
   */
  userSubscriptionBillingQuarterly: boolean | null;
};

const CARDS: {
  key: SectionKey;
  title: string;
  description: string;
  /** Ícone Lucide só quando não há imagem em `INTEGRATION_CARD_IMAGES`. */
  icon: LucideIcon;
  /** Oculta o card na grelha (rota/API podem continuar a existir). */
  hidden?: boolean;
}[] = [
  {
    key: "shopee",
    title: "Integração Shopee",
    description: "API Shopee.",
    icon: Wallet,
  },
  {
    key: "mercadolivre",
    title: "Integração ML",
    description: "Etiqueta em uso e token da extensão",
    icon: Wallet,
  },
  {
    key: "amazon",
    title: "Integração Amazon",
    description: "Associate Tag e token da extensão",
    icon: Wallet,
  },
  {
    key: "meta",
    title: "Meta Ads",
    description: "Token de acesso para campanhas e ATI",
    icon: Wallet,
  },
  {
    key: "evolution",
    title: "Integrações",
    description: "Instâncias WhatsApp e bots Telegram",
    icon: Wallet,
  },
  {
    key: "mercadopago",
    title: "Infoprodutor",
    description: "Conecte suas formas de pagamento.",
    icon: Wallet,
  },
  {
    key: "notificacoes",
    title: "Ativar notificação",
    description: "",
    icon: Bell,
  },
];

/** Ícones da grelha Minha Conta — mesmos assets que marketplace/automações (Amazon já usava imagem). */
const INTEGRATION_CARD_IMAGES: Partial<
  Record<NonNullable<SectionKey>, { src: string; alt: string; className: string }>
> = {
  shopee: {
    src: "/icons-integracoes/shopee-icon-laranja2.svg",
    alt: "Shopee",
    className: "h-5 w-5 object-contain",
  },
  mercadolivre: {
    src: "/ml.png",
    alt: "Mercado Livre",
    className: "h-5 w-auto max-w-[40px] object-contain",
  },
  amazon: {
    src: "/amazonlogo.webp",
    alt: "Amazon",
    className: "h-5 w-5 object-contain",
  },
  meta: {
    src: "/icons-integracoes/icon-meta.svg",
    alt: "Meta",
    className: "h-5 w-5 object-contain",
  },
  evolution: {
    src: "/icons-integracoes/icon-whatsapp.svg",
    alt: "WhatsApp",
    className: "h-5 w-5 object-contain",
  },
};

function IntegrationCardLeadingIcon({
  sectionKey,
  FallbackIcon,
}: {
  sectionKey: SectionKey;
  FallbackIcon: LucideIcon;
}) {
  const img = sectionKey ? INTEGRATION_CARD_IMAGES[sectionKey] : undefined;
  if (img) {
    return (
      <Image
        src={img.src}
        alt={img.alt}
        width={20}
        height={20}
        className={img.className}
      />
    );
  }
  return <FallbackIcon className="h-5 w-5" />;
}

/** Colunas alinhadas ao número de cards visíveis — evita “buraco” (ex.: 3 itens em grelha de 4 colunas). */
function integrationCardsGridClass(visibleCount: number) {
  const base = "grid gap-4";
  if (visibleCount <= 1) return `${base} grid-cols-1`;
  if (visibleCount === 2) return `${base} grid-cols-1 sm:grid-cols-2`;
  if (visibleCount === 3) return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`;
}

export default function ConfiguracoesClient({
  initialAppId,
  initialHasKey,
  initialLast4,
  initialOpenMl,
  initialMlClientId = "",
  initialMlHasSecret = false,
  initialMlSecretLast4 = null,
  metaHasToken,
  metaLast4,
  canUseMercadoLivre,
  canUseAmazon,
  canUseMetaAds,
  canUseInfoprodutor,
  currentPlanToneForPricing,
  userSubscriptionBillingQuarterly,
}: ConfiguracoesClientProps) {
  const [openSection, setOpenSection] = useState<SectionKey>(
    MERCADOLIVRE_UX_COMING_SOON ? null : initialOpenMl ? "mercadolivre" : null,
  );
  // Banner inline mostrado quando o user clica num card bloqueado por entitlement.
  const [lockedCardPrompt, setLockedCardPrompt] = useState<null | "mercadolivre" | "amazon" | "meta" | "mercadopago">(null);
  const visibleCards = CARDS.filter((c) => !c.hidden);

  // Mapa: card -> está bloqueado pra esse plano? (mas continua visível).
  const cardLocked = (key: SectionKey): boolean => {
    if (key === "mercadolivre") return !canUseMercadoLivre;
    if (key === "amazon") return !canUseAmazon;
    if (key === "meta") return !canUseMetaAds;
    if (key === "mercadopago") return !canUseInfoprodutor;
    return false;
  };

  // Se o usuário voltou do callback OAuth do Mercado Pago, abre o card MP
  // automaticamente para mostrar o banner de sucesso/erro.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("mp")) setOpenSection("mercadopago");
  }, []);

  return (
    <div className="space-y-6">
      {/* Grid de cards */}
      <div className={integrationCardsGridClass(visibleCards.length)}>
        {visibleCards.map(({ key, title, description, icon: Icon }) => {
          const mlCardBlocked = MERCADOLIVRE_UX_COMING_SOON && key === "mercadolivre";
          if (mlCardBlocked) {
            return (
              <div
                key={key ?? "ml-blocked"}
                className="flex w-full min-w-0 cursor-not-allowed items-start gap-4 rounded-xl border border-dark-border bg-dark-card p-4 text-left opacity-90"
                role="group"
                aria-disabled="true"
                aria-label={`${title} — em breve`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange">
                  <IntegrationCardLeadingIcon sectionKey={key} FallbackIcon={Icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                    <span>{title}</span>
                    <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Em breve
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary/50" aria-hidden />
              </div>
            );
          }
          const locked = cardLocked(key);
          return (
            <button
              key={key ?? "null"}
              type="button"
              aria-disabled={locked}
              onClick={() => {
                if (locked) {
                  setLockedCardPrompt(key as "mercadolivre" | "amazon" | "meta" | "mercadopago");
                  return;
                }
                setLockedCardPrompt(null);
                setOpenSection(openSection === key ? null : key);
              }}
              className={`flex w-full min-w-0 items-start gap-4 rounded-xl border bg-dark-card p-4 text-left transition-all ${
                locked
                  ? "opacity-70 hover:border-shopee-orange/45"
                  : "hover:border-shopee-orange/50 hover:bg-dark-card/90"
              } ${
                openSection === key && !locked
                  ? "border-shopee-orange/60 ring-1 ring-shopee-orange/20"
                  : "border-dark-border"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange">
                <IntegrationCardLeadingIcon sectionKey={key} FallbackIcon={Icon} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                  <span>{title}</span>
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{description}</p>
              </div>
              {locked ? (
                <Lock className="h-5 w-5 shrink-0 text-shopee-orange/85" aria-hidden />
              ) : (
                <ChevronRight
                  className={`h-5 w-5 shrink-0 text-text-secondary transition-transform ${openSection === key ? "rotate-90" : ""}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Banner de upgrade quando o user clica num card bloqueado. */}
      {lockedCardPrompt && (
        <UpgradePlanNotice
          title={
            lockedCardPrompt === "mercadolivre"
              ? "Integração Mercado Livre é exclusiva do Plano Padrão"
              : lockedCardPrompt === "amazon"
                ? "Integração Amazon é exclusiva do Plano Padrão"
                : lockedCardPrompt === "meta"
                  ? "Meta Ads (campanhas e ATI) é exclusiva do Plano Padrão"
                  : "Integração Infoprodutor é exclusiva do Plano Padrão"
          }
          description={
            lockedCardPrompt === "mercadolivre"
              ? "Faça upgrade pra conectar sua conta ML, gerenciar etiquetas e usar listas Mercado Livre nas automações."
              : lockedCardPrompt === "amazon"
                ? "Faça upgrade pra conectar sua conta Amazon Associados, gerenciar Associate Tag e usar listas Amazon nas automações."
                : lockedCardPrompt === "meta"
                  ? "Faça upgrade pra criar campanhas no Meta direto pelo painel e ativar o Tráfego Inteligente (ATI)."
                  : "Faça upgrade pra conectar Mercado Pago e vender infoprodutos pelas automações."
          }
          onClose={() => setLockedCardPrompt(null)}
          currentPlanToneForPricing={currentPlanToneForPricing}
          userSubscriptionBillingQuarterly={userSubscriptionBillingQuarterly}
        />
      )}

      {/* Conteúdo do card selecionado */}
      {openSection === "shopee" && (
        <div className="animate-in fade-in duration-200">
          <ShopeeIntegrationCard
            initialAppId={initialAppId}
            initialHasKey={initialHasKey}
            initialLast4={initialLast4}
          />
        </div>
      )}
      {openSection === "mercadolivre" && !MERCADOLIVRE_UX_COMING_SOON && (
        <div className="animate-in fade-in duration-200">
          <MercadoLivreIntegrationCard
            initialClientId={initialMlClientId}
            initialHasSecret={initialMlHasSecret}
            initialSecretLast4={initialMlSecretLast4}
          />
        </div>
      )}
      {openSection === "amazon" && (
        <div className="animate-in fade-in duration-200">
          <AmazonIntegrationCard />
        </div>
      )}
      {openSection === "meta" && (
        <div className="animate-in fade-in duration-200">
          <MetaIntegrationCard initialHasToken={metaHasToken} initialLast4={metaLast4} />
        </div>
      )}
      {openSection === "evolution" && (
        <div className="animate-in fade-in duration-200">
          <MessagingChannelsCard />
        </div>
      )}
      {openSection === "mercadopago" && (
        <div className="animate-in fade-in duration-200 space-y-4">
          <MercadoPagoIntegrationCard />
          <ShippingProfileCard />
        </div>
      )}
      {openSection === "notificacoes" && (
        <div className="animate-in fade-in duration-200">
          <NotificacoesCard />
        </div>
      )}
    </div>
  );
}
