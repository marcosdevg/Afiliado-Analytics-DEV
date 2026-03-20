"use client";

import { HelpCircle } from "lucide-react";

/** Ícone de ajuda com tooltip nativo (`title`) — padrão do app para formulários Meta. */
export function MetaFormHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex shrink-0"
      title={text}
      aria-label={text}
    >
      <HelpCircle className="h-3.5 w-3.5 text-text-secondary/45 hover:text-shopee-orange cursor-help transition-colors" />
    </span>
  );
}

type LabelProps = {
  htmlFor?: string;
  children: React.ReactNode;
  /** Texto do tooltip (ícone ao lado do rótulo). */
  hint?: string;
  className?: string;
};

export function MetaFormLabel({ htmlFor, children, hint, className = "" }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`flex items-center gap-1.5 text-sm font-medium text-text-primary mb-1 ${className}`}
    >
      <span className="min-w-0">{children}</span>
      {hint ? <MetaFormHint text={hint} /> : null}
    </label>
  );
}
