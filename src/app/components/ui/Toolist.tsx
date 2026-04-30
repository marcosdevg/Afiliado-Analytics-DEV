"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const TOOLIST_BG = "var(--color-dark-tooltip)";
const TOOLIST_BORDER = "var(--color-dark-border)";

export type ToolistProps = {
  text: string;
  /**
   * `floating` — caixa acima do ícone, seta apontando para baixo (padrão Configurar Link / gerador).
   * `below` — caixa abaixo do ícone, seta apontando para cima; mesmo visual (#2d2e32, texto centralizado).
   */
  variant?: "floating" | "below";
  wide?: boolean;
  className?: string;
  iconClassName?: string;
};

function ToolistBubble({
  text,
  wide,
  arrow,
}: {
  text: string;
  wide?: boolean;
  arrow: "down" | "up";
}) {
  const maxW = wide ? "min(92vw,26rem)" : "min(92vw,17rem)";
  return (
    <div
      className="pointer-events-none w-max shadow-lg"
      style={{ maxWidth: maxW }}
    >
      {arrow === "up" ? (
        <div className="flex flex-col items-center">
          <div
            className="h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent"
            style={{ borderBottomColor: TOOLIST_BG }}
            aria-hidden
          />
          <div
            className="-mt-px rounded-xl px-3 py-2.5 text-center"
            style={{
              backgroundColor: TOOLIST_BG,
              border: `1px solid ${TOOLIST_BORDER}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
          >
            <p className="text-[11px] sm:text-xs font-normal leading-relaxed text-text-primary whitespace-normal">
              {text}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div
            className="rounded-xl px-3 py-2.5 text-center"
            style={{
              backgroundColor: TOOLIST_BG,
              border: `1px solid ${TOOLIST_BORDER}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            }}
          >
            <p className="text-[11px] sm:text-xs font-normal leading-relaxed text-text-primary whitespace-normal">
              {text}
            </p>
          </div>
          <div
            className="h-0 w-0 border-x-[7px] border-t-[7px] border-x-transparent -mt-px"
            style={{ borderTopColor: TOOLIST_BG }}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}

/**
 * Ajuda contextual no padrão do app (caixa #2d2e32, texto branco centralizado, seta para o ícone).
 */
export default function Toolist({
  text,
  variant = "floating",
  wide,
  className = "",
  iconClassName = "",
}: ToolistProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    if (variant === "below") {
      setPos({ top: r.bottom + 10, left: cx });
    } else {
      setPos({ top: r.top - 6, left: cx });
    }
  }, [variant]);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const tick = () => updatePosition();
    tick();
    const raf = requestAnimationFrame(tick);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [open, updatePosition]);

  const floatingPanel = (
    <div
      id={tooltipId}
      role="tooltip"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        zIndex: 99999,
      }}
    >
      <ToolistBubble text={text} wide={wide} arrow="down" />
    </div>
  );

  const belowPanel = (
    <div
      id={tooltipId}
      role="tooltip"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
        zIndex: 99999,
      }}
    >
      <ToolistBubble text={text} wide={wide} arrow="up" />
    </div>
  );

  return (
    <>
      <span
        ref={anchorRef}
        className={`inline-flex items-center justify-center shrink-0 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-shopee-orange/40 focus-visible:rounded-full ${className}`}
        tabIndex={0}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <span className="toolist-trigger inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors">
          <Info className={`h-2.5 w-2.5 ${iconClassName}`} strokeWidth={2.5} />
        </span>
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(variant === "below" ? belowPanel : floatingPanel, document.body)
        : null}
    </>
  );
}
