"use client";

/**
 * "Hero" do mascote Sho.IA — saudação personalizada com o nome do usuário
 * (parte antes do @ no email) + tabela enxuta de produtos "escaláveis":
 * combinação de score alto + comissão acima da média + bom rating. A ideia é
 * que o vendedor abra a página e já tenha um corte curado pra usar em ATI ou
 * em grupos de WhatsApp, sem precisar varrer o catálogo inteiro.
 */

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Copy, ExternalLink, ListPlus, Sparkles, Star } from "lucide-react";
import Toolist from "@/app/components/ui/Toolist";

/** Aceita qualquer shape com os campos que usamos. Permite passar o
 *  `TrendProduct` completo do client principal sem precisar mapear antes. */
type ProductRow = {
  itemId: number;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  commissionRate: number | null;
  ratingStar: number | null;
  score: number;
  isViral: boolean;
  productLink?: string | null;
  sales?: number | null;
  salesDelta24h?: number | null;
};

function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

/**
 * "Os mais vendidos da Shopee agora" — critério direto: ranqueia pelo delta
 * de vendas das últimas 24h (`salesDelta24h`, calculado no servidor a partir
 * do histórico de observations). Quando ainda não há histórico (cron rodou
 * pouca vezes), cai pra `sales` cumulativo absoluto. Filtra só produtos com
 * rating ≥ 4.0 pra evitar lixões.
 */
function pickScalableProducts<T extends ProductRow>(products: T[], target = 6): T[] {
  if (products.length === 0) return [];
  const filtered = products.filter((p) => (p.ratingStar ?? 0) >= 4.0);
  const hasDeltaData = filtered.some((p) => (p.salesDelta24h ?? 0) > 0);

  return filtered
    .sort((a, b) => {
      // Modo dinâmico: usa delta diário quando há histórico
      if (hasDeltaData) {
        const aDelta = a.salesDelta24h ?? 0;
        const bDelta = b.salesDelta24h ?? 0;
        if (bDelta !== aDelta) return bDelta - aDelta;
        // tiebreaker pra produtos com mesmo delta: vendas absolutas
        return (b.sales ?? 0) - (a.sales ?? 0);
      }
      // Fallback (primeiras horas após primeiro cron): vendas absolutas
      return (b.sales ?? 0) - (a.sales ?? 0);
    })
    .slice(0, target);
}

function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export function EscalaveisHero<T extends ProductRow>({
  userEmail,
  products,
  onAddToList,
  onConvert,
}: {
  userEmail: string;
  products: T[];
  onAddToList: (p: T) => void;
  onConvert: (p: T) => void;
}) {
  const recommended = useMemo(() => pickScalableProducts(products), [products]);
  const username = useMemo(() => emailLocalPart(userEmail), [userEmail]);

  if (recommended.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[#2c2c32] light:border-zinc-200 bg-gradient-to-br from-[#1c1c1f] via-[#211b1f] to-[#1c1c1f] light:from-cyan-50 light:via-white light:to-orange-50 overflow-hidden">
      {/* Header com mascote (cabecasho.png — variante "cabeça" do Sho) */}
      <div className="px-4 py-4 sm:p-5 flex items-start gap-3 sm:gap-4 border-b border-[#2c2c32] light:border-zinc-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tendencias/cabecasho.png"
          alt="Sho.IA, sua assistente de tendências"
          className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 drop-shadow-[0_4px_18px_rgba(238,77,45,0.25)] animate-shoia-float"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-[#ee4d2d]" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#ee4d2d]">
              Sho.IA · curadoria
            </span>
            <Toolist
              variant="below"
              wide
              text="Aqui estão alguns produtos que podem ser escalados em grupos de WhatsApp ou no ATI — score alto, comissão acima da média e bom rating."
            />
          </div>
          <h2 className="text-[14px] sm:text-base font-bold text-text-primary light:text-zinc-900 leading-snug">
            Oi, <span className="text-[#ee4d2d]">{username}</span>! Veja o que está vendendo MUITO agora na Shopee:
          </h2>
        </div>
      </div>


      {/* Tabela tipo Excel — sem coluna preço; comissão mostrada em R$ */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-[#222228] light:bg-zinc-100 text-[9px] uppercase tracking-widest text-[#9a9aa2] light:text-zinc-500 font-bold">
              <th className="px-3 py-2 text-left">Produto</th>
              <th className="px-3 py-2 text-center">Comissão</th>
              <th className="px-3 py-2 text-center">Score</th>
              <th className="px-3 py-2 text-center hidden md:table-cell">Rating</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2c2c32] light:divide-zinc-200">
            {recommended.map((p) => {
              // Comissão em R$ — usa preço base do produto (priceMin se houver
              // faixa, senão price). Quando não dá pra calcular, mostra "—".
              const basePrice = p.price ?? p.priceMin ?? null;
              const commValue =
                basePrice != null && p.commissionRate != null
                  ? basePrice * p.commissionRate
                  : null;
              return (
                <tr
                  key={p.itemId}
                  className="hover:bg-[#222228]/50 light:hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.productName}
                          className="w-9 h-9 rounded-md object-cover bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 shrink-0" />
                      )}
                      {/* Nome do produto só em desktop — mobile fica com a
                          imagem como identidade visual. */}
                      <span
                        className="hidden sm:inline text-[11px] font-semibold text-text-primary light:text-zinc-900 line-clamp-2 leading-snug"
                        title={p.productName}
                      >
                        {p.productName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {commValue != null ? (
                      <span className="text-emerald-400 light:text-emerald-700 font-bold tabular-nums text-[9px] sm:text-[11px]">
                        {formatBRL(commValue)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#7a7a80]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center min-w-[28px] sm:min-w-[34px] px-1 sm:px-1.5 py-0.5 rounded-md font-black tabular-nums text-[8px] sm:text-[10px] ${
                        p.score >= 75
                          ? "bg-[#ee4d2d] text-white"
                          : p.score >= 50
                            ? "bg-[#0ea5e9] text-white"
                            : "bg-[#3e3e46] light:bg-zinc-300 text-[#c8c8ce] light:text-zinc-700"
                      }`}
                    >
                      {p.score}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center hidden md:table-cell">
                    {p.ratingStar != null ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 light:text-amber-700">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {p.ratingStar.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#7a7a80]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1 justify-end">
                      {p.productLink ? (
                        <a
                          href={p.productLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir na Shopee"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onAddToList(p)}
                        title="Adicionar à lista"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                      >
                        <ListPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onConvert(p)}
                        title="Converter link afiliado"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-[#ee4d2d]/40 bg-[#ee4d2d]/10 text-[#ee4d2d] hover:bg-[#ee4d2d]/20"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer com link pra gerador (ponte natural) */}
      <div className="px-3 sm:px-4 py-2.5 border-t border-[#2c2c32] light:border-zinc-200 flex items-center justify-between gap-2">
        <span className="hidden sm:inline text-[10px] text-[#7a7a80] light:text-zinc-500">
          Ranking: vendas das últimas 24h (com fallback nas mais vendidas absolutas)
        </span>
        <Link
          href="/dashboard/gerador-links-shopee"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7cd0f7] light:text-cyan-700 hover:underline ml-auto"
          title="Buscar mais produtos no Gerador"
        >
          <span className="hidden sm:inline">Buscar mais produtos no </span>
          Gerador
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
