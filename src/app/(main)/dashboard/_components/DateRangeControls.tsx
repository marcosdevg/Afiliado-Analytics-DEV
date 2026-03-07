"use client";

import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  from: string;
  to: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  minDate: string; // limite mínimo do relatório
  maxDate: string; // limite máximo do relatório
  disabled?: boolean;
  actions?: ReactNode;
};

export default function DateRangeControls({
  from,
  to,
  onChangeFrom,
  onChangeTo,
  minDate,
  maxDate,
  disabled = false,
  actions,
}: Props) {
  // Comparação segura para formato YYYY-MM-DD
  const isAfter = (a: string, b: string) => !!a && !!b && a > b; // a > b => a é depois
  const isBefore = (a: string, b: string) => !!a && !!b && a < b; // a < b => a é antes

  function handleChangeFrom(nextFrom: string) {
    onChangeFrom(nextFrom);

    if (to && nextFrom && isAfter(nextFrom, to)) {
      onChangeTo(nextFrom);
    }
  }

  function handleChangeTo(nextTo: string) {
    onChangeTo(nextTo);

    if (from && nextTo && isBefore(nextTo, from)) {
      onChangeFrom(nextTo);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="flex items-center gap-2 text-text-secondary">
        <CalendarDays className="h-5 w-5" />
        <span>Período:</span>
      </div>

      {/* Campo inicial — mostra TODAS as datas disponíveis (minDate..maxDate) */}
      <input
        type="date"
        value={from}
        min={minDate}
        max={maxDate}
        onChange={(e) => handleChangeFrom(e.target.value)}
        disabled={disabled}
        className="date-input rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-text-primary text-sm focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange disabled:opacity-40 disabled:cursor-not-allowed"
      />

      <span className="text-text-secondary">até</span>

      {/* Campo final — mostra TODAS as datas disponíveis (minDate..maxDate) */}
      <input
        type="date"
        value={to}
        min={minDate}
        max={maxDate}
        onChange={(e) => handleChangeTo(e.target.value)}
        disabled={disabled}
        className="date-input rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-text-primary text-sm focus:border-shopee-orange focus:outline-none focus:ring-1 focus:ring-shopee-orange disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}

      <style jsx>{`
        /* Chrome/Edge/Safari: dá para “recolorir” só via filter no ícone nativo */
        .date-input::-webkit-calendar-picker-indicator {
          opacity: 0.9;
          cursor: pointer;
          filter: invert(1) brightness(1.1);
        }

        .date-input:disabled::-webkit-calendar-picker-indicator {
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
}
