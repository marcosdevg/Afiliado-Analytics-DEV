"use client";

import type { AnchorHTMLAttributes } from "react";

const HREF = "https://afiliadoanalytics.com.br";

/**
 * Link do rodapé nos sites de captura: a marca "Afiliado Analytics" abre o site em nova aba.
 */
export function CaptureFooterAfiliadoAnalyticsLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { children, ...rest } = props;
  return (
    <a href={HREF} target="_blank" rel="noopener noreferrer" {...rest}>
      {children ?? "Afiliado Analytics"}
    </a>
  );
}
