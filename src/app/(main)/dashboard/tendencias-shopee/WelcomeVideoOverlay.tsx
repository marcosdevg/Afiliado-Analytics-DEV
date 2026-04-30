"use client";

/**
 * Overlay de boas-vindas exibido 1x por dia ao abrir a aba Tendências Shopee.
 * Posição absoluta dentro do container da página (não cobre header/sidebar/footer).
 *
 * Comportamento:
 *   - Mobile (≤640px): toca `/tendencias/mobile.mp4`
 *   - Desktop:         toca `/tendencias/desktopshoia.mp4`
 *   - autoplay + muted + playsInline (necessário pra autoplay no iOS)
 *   - Toca 1x e fecha sozinho
 *   - Pode fechar antes com X, clique fora, ou tecla ESC
 *   - Ao fechar, salva a data de hoje em localStorage — só reabre amanhã
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "shoia-welcome-shown-date";
const MAX_PLAYS = 1;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WelcomeVideoOverlay() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Contador manual de reproduções — substituímos o atributo `loop` por
  // listener `onEnded` pra controlar exatamente N repetições.
  const playCountRef = useRef(0);

  // Decide se mostra hoje. Roda só no client (localStorage não existe no server).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== todayKey()) {
        playCountRef.current = 0;
        setOpen(true);
      }
    } catch {
      /* localStorage pode falhar em iframes/sandbox — não trava */
    }
  }, []);

  // Detecta mobile pra escolher a fonte do vídeo. matchMedia atualiza em vivo
  // se o usuário rotacionar a tela ou redimensionar (DevTools).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, todayKey());
    } catch {
      /* ignora */
    }
  }, []);

  // Fechar com tecla ESC (acessibilidade + ergonomia desktop).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open) return null;

  const src = isMobile ? "/tendencias/mobile.mp4" : "/tendencias/desktopshoia.mp4";

  return (
    <div
      className="absolute inset-0 z-30 bg-black overflow-hidden"
      onClick={handleClose}
      role="dialog"
      aria-label="Apresentação Tendências Shopee"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        title="Fechar"
        className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70 hover:border-white/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* `key` força o React a remontar o <video> quando trocar mobile↔desktop,
           garantindo que o autoplay reinicie com a fonte correta.
           `object-cover` preenche todo o container — pode cortar bordas do
           vídeo em telas com aspect ratio diferente, mas elimina as faixas
           pretas (letterbox) que apareciam com `object-contain`. */}
      <video
        key={src}
        autoPlay
        muted
        playsInline
        controls={false}
        onClick={(e) => e.stopPropagation()}
        onEnded={(e) => {
          playCountRef.current += 1;
          if (playCountRef.current >= MAX_PLAYS) {
            handleClose();
            return;
          }
          // Reseta e dispara replay manual (substitui o atributo `loop`).
          const v = e.currentTarget;
          v.currentTime = 0;
          void v.play();
        }}
        className="w-full h-full object-cover"
        src={src}
      />
    </div>
  );
}
