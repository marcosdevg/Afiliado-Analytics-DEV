"use client";

import { useState } from "react";
import { IdCard, Megaphone, MessageCircle, ChevronRight, ShoppingBag } from "lucide-react";
import ShopeeIntegrationCard from "./ShopeeIntegrationCard";
import MetaIntegrationCard from "./MetaIntegrationCard";
import EvolutionIntegrationCard from "./EvolutionIntegrationCard";
import MercadoLivreIntegrationCard from "./MercadoLivreIntegrationCard";

export type SectionKey = "shopee" | "mercadolivre" | "meta" | "evolution" | null;

type ConfiguracoesClientProps = {
  initialAppId: string;
  initialHasKey: boolean;
  initialLast4: string | null;
  mlInitialClientId: string;
  mlInitialHasSecret: boolean;
  mlInitialLast4: string | null;
  metaHasToken: boolean;
  metaLast4: string | null;
};

const CARDS: {
  key: SectionKey;
  title: string;
  description: string;
  icon: React.ElementType;
  /** Oculta o card na grelha (rota/API podem continuar a existir). */
  hidden?: boolean;
}[] = [
  {
    key: "shopee",
    title: "Integração Shopee",
    description: "App ID e API Key para comissões e relatórios",
    icon: IdCard,
  },
  {
    key: "mercadolivre",
    title: "Mercado Livre API",
    description: "Client ID e Secret — dados de anúncios",
    icon: ShoppingBag,
    hidden: true,
  },
  {
    key: "meta",
    title: "Meta Ads",
    description: "Token de acesso para campanhas e ATI",
    icon: Megaphone,
  },
  {
    key: "evolution",
    title: "Integração WhatsApp",
    description: "Instâncias WhatsApp",
    icon: MessageCircle,
  },
];

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
  mlInitialClientId,
  mlInitialHasSecret,
  mlInitialLast4,
  metaHasToken,
  metaLast4,
}: ConfiguracoesClientProps) {
  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const visibleCards = CARDS.filter((c) => !c.hidden);

  return (
    <div className="space-y-6">
      {/* Grid de cards */}
      <div className={integrationCardsGridClass(visibleCards.length)}>
        {visibleCards.map(({ key, title, description, icon: Icon }) => (
          <button
            key={key ?? "null"}
            type="button"
            onClick={() => setOpenSection(openSection === key ? null : key)}
            className={`flex w-full min-w-0 items-start gap-4 rounded-xl border bg-dark-card p-4 text-left transition-all hover:border-shopee-orange/50 hover:bg-dark-card/90 ${
              openSection === key ? "border-shopee-orange/60 ring-1 ring-shopee-orange/20" : "border-dark-border"
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg ${
                key === "mercadolivre" ? "text-amber-400" : "text-shopee-orange"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">{title}</p>
              <p className="text-xs text-text-secondary mt-0.5">{description}</p>
            </div>
            <ChevronRight
              className={`h-5 w-5 shrink-0 text-text-secondary transition-transform ${openSection === key ? "rotate-90" : ""}`}
            />
          </button>
        ))}
      </div>

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
      {openSection === "mercadolivre" && (
        <div className="animate-in fade-in duration-200">
          <MercadoLivreIntegrationCard
            initialClientId={mlInitialClientId}
            initialHasSecret={mlInitialHasSecret}
            initialLast4={mlInitialLast4}
          />
        </div>
      )}
      {openSection === "meta" && (
        <div className="animate-in fade-in duration-200">
          <MetaIntegrationCard initialHasToken={metaHasToken} initialLast4={metaLast4} />
        </div>
      )}
      {openSection === "evolution" && (
        <div className="animate-in fade-in duration-200">
          <EvolutionIntegrationCard />
        </div>
      )}
    </div>
  );
}
