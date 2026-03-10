"use client";

import { useState } from "react";
import { IdCard, Megaphone, MessageCircle, ChevronRight } from "lucide-react";
import ShopeeIntegrationCard from "./ShopeeIntegrationCard";
import MetaIntegrationCard from "./MetaIntegrationCard";
import EvolutionIntegrationCard from "./EvolutionIntegrationCard";

export type SectionKey = "shopee" | "meta" | "evolution" | null;

type ConfiguracoesClientProps = {
  initialAppId: string;
  initialHasKey: boolean;
  initialLast4: string | null;
  metaHasToken: boolean;
  metaLast4: string | null;
};

const CARDS: { key: SectionKey; title: string; description: string; icon: React.ElementType }[] = [
  {
    key: "shopee",
    title: "Integração Shopee",
    description: "App ID e API Key para comissões e relatórios",
    icon: IdCard,
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

export default function ConfiguracoesClient({
  initialAppId,
  initialHasKey,
  initialLast4,
  metaHasToken,
  metaLast4,
}: ConfiguracoesClientProps) {
  const [openSection, setOpenSection] = useState<SectionKey>(null);

  return (
    <div className="space-y-6">
      {/* Grid de cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map(({ key, title, description, icon: Icon }) => (
          <button
            key={key ?? "null"}
            type="button"
            onClick={() => setOpenSection(openSection === key ? null : key)}
            className={`flex items-start gap-4 rounded-xl border bg-dark-card p-4 text-left transition-all hover:border-shopee-orange/50 hover:bg-dark-card/90 ${
              openSection === key ? "border-shopee-orange/60 ring-1 ring-shopee-orange/20" : "border-dark-border"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange">
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
