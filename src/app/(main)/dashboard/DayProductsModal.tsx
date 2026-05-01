"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProductData } from "@/types";

const PAGE_SIZE = 20;

type DayProductsModalProps = {
  open: boolean;
  onClose: () => void;
  dayLabel: string;
  products: ProductData[];
};

export default function DayProductsModal({ open, onClose, dayLabel, products }: DayProductsModalProps) {
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (open) setPage(0);
  }, [open, dayLabel]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const slice = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return products.slice(start, start + PAGE_SIZE);
  }, [products, safePage]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-10 bg-black/70 backdrop-blur-sm light:bg-zinc-900/35 light:backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-products-title"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {/* Wrapper: card ancora o mascote acima (nunca cobre conteúdo). */}
      <div
        className="relative w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src="/tendencias/shosearch.png"
          alt=""
          width={140}
          height={175}
          aria-hidden="true"
          className="pointer-events-none select-none absolute bottom-full left-3 sm:left-5 mb-[-4.25rem] sm:mb-[-3.75rem] w-[5rem] sm:w-[6rem] h-auto object-contain drop-shadow-xl"
        />

        <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-xl border border-dark-border bg-dark-card shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-dark-border bg-dark-card px-4 pt-4 pb-3 sm:px-5 pl-[6.5rem] sm:pl-[7.75rem]">
            <h2
              id="day-products-title"
              className="text-base sm:text-lg font-semibold text-text-primary font-heading pr-2"
            >
              Produtos vendidos — {dayLabel}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-text-secondary hover:bg-dark-bg hover:text-text-primary"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto bg-dark-card px-4 py-3 sm:px-5 flex-1 min-h-0">
            {slice.length === 0 ? (
              <p className="text-sm text-text-secondary py-6 text-center">
                Nenhum produto com venda concluída ou pendente neste dia.
              </p>
            ) : (
              <ul className="space-y-2">
                {slice.map((p, idx) => (
                  <li
                    key={`${safePage}-${idx}-${p.productName}`}
                    className="rounded-lg border border-dark-border bg-dark-bg/60 px-3 py-2.5 text-sm"
                  >
                    <div className="font-medium text-text-primary line-clamp-2">{p.productName}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-text-secondary">
                      <span>Qtd: {p.qty}</span>
                      <span>
                        Comissão:{" "}
                        {p.commission.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {products.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-dark-border bg-dark-card px-4 py-3 sm:px-5">
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-dark-border px-3 py-1.5 text-sm text-text-primary disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="text-xs text-text-secondary text-center">
                Página {safePage + 1} de {totalPages}
                <span className="hidden sm:inline"> ({products.length} produtos)</span>
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-dark-border px-3 py-1.5 text-sm text-text-primary disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
