"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint && typeof window !== "undefined") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  return (
    <div className="print:hidden flex items-center gap-2 flex-wrap">
      <Link
        href="/dashboard/infoprodutor"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-[#2f2f34]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#635bff] hover:bg-[#5047e5] text-white text-xs font-semibold"
      >
        <Printer className="w-3.5 h-3.5" />
        Imprimir etiqueta
      </button>
    </div>
  );
}
