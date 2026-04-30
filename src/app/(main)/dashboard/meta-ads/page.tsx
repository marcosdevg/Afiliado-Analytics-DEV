"use client";

import Link from "next/link";
import { ArrowLeft, Megaphone, Wrench } from "lucide-react";
import MetaAdsClient from "./MetaAdsClient";
import ProFeatureGate from "../ProFeatureGate";
import { META_ADS_MAINTENANCE } from "@/lib/meta-ads-maintenance";

export default function MetaAdsPage() {
  if (META_ADS_MAINTENANCE) {
    return <MaintenanceCard />;
  }
  return (
    <ProFeatureGate feature="criarCampanhaMeta">
      <MetaAdsClient />
    </ProFeatureGate>
  );
}

function MaintenanceCard() {
  return (
    <div className="bg-dark-bg light:bg-zinc-50 min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-amber-500/5 light:bg-amber-50 light:border-amber-300 p-6 sm:p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/15 light:bg-amber-100 mb-4">
          <Wrench className="w-7 h-7 text-amber-400 light:text-amber-700" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 light:bg-amber-100 mb-3">
          <Megaphone className="w-3 h-3 text-amber-400 light:text-amber-700" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400 light:text-amber-700">
            Criar Campanha Meta
          </span>
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-text-primary light:text-zinc-900">
          Em manutenção
        </h1>
        <p className="mt-2 text-[12px] sm:text-[13px] text-text-secondary light:text-zinc-600 leading-relaxed">
          Estamos atualizando essa ferramenta pra trazer melhorias importantes.
          Volta em breve — agradecemos a paciência!
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-amber-500 text-amber-950 font-semibold text-[12px] hover:bg-amber-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para o Dashboard
        </Link>
      </div>
    </div>
  );
}
