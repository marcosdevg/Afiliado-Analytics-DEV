"use client";

import { useMemo } from "react";

type Rgba = { r: number; g: number; b: number; a: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3 && /^[0-9a-f]{3}$/i.test(h)) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6 && /^[0-9a-f]{6}$/i.test(h)) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const t = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}

/** Parse #rgb, #rrggbb, rgb(), rgba() */
export function parseCssColor(input: string): Rgba | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (s[0] === "#") {
    const slice = s.length >= 7 ? s.slice(0, 7) : s.length === 4 ? s : s.slice(0, 7);
    const rgb = hexToRgb(slice);
    if (rgb) return { ...rgb, a: 1 };
    return null;
  }
  const m = s.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i,
  );
  if (m) {
    return {
      r: clamp(Number(m[1]), 0, 255),
      g: clamp(Number(m[2]), 0, 255),
      b: clamp(Number(m[3]), 0, 255),
      a: m[4] !== undefined ? clamp(Number(m[4]), 0, 1) : 1,
    };
  }
  return null;
}

function formatAsCss(c: Rgba, allowAlpha: boolean): string {
  const { r, g, b, a } = c;
  if (!allowAlpha || a >= 0.999) return rgbToHex(r, g, b);
  let aStr = a.toFixed(3);
  aStr = aStr.replace(/0+$/, "").replace(/\.$/, "");
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${aStr})`;
}

function previewBackground(
  value: string,
  displayHex: string,
  parsed: Rgba | null,
  allowAlpha: boolean,
): string {
  if (parsed) {
    if (allowAlpha && parsed.a < 0.999) return formatAsCss(parsed, true);
    return rgbToHex(parsed.r, parsed.g, parsed.b);
  }
  return displayHex;
}

export type EmBrancoCssColorFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  allowAlpha?: boolean;
  /** Cor do seletor nativo quando o valor não é interpretável */
  fallbackHex?: string;
};

function ColorSwatchTrigger(props: {
  displayHex: string;
  previewBg: string;
  showChecker: boolean;
  onPick: (hex: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex rounded-xl p-0.5 ring-1 ring-white/10 bg-dark-card/50 shadow-inner transition-shadow focus-within:ring-2 focus-within:ring-shopee-orange/50 focus-within:ring-offset-2 focus-within:ring-offset-dark-bg">
      <div className="relative h-[3.75rem] w-[3.75rem] shrink-0 overflow-hidden rounded-lg sm:h-16 sm:w-16">
        {props.showChecker ? (
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background:
                "repeating-conic-gradient(#6b6b6b 0% 25%, #9a9a9a 0% 50%) 50% / 10px 10px",
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 rounded-lg ring-1 ring-inset ring-black/30"
          style={{ backgroundColor: props.previewBg }}
        />
        <input
          type="color"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={props.displayHex}
          onChange={(e) => props.onPick(e.target.value)}
          aria-label={props.ariaLabel}
        />
      </div>
    </div>
  );
}

export default function EmBrancoCssColorField({
  label,
  value,
  onChange,
  allowAlpha = false,
  fallbackHex = "#000000",
}: EmBrancoCssColorFieldProps) {
  const parsed = useMemo(() => parseCssColor(value), [value]);
  const hexFromParsed = parsed ? rgbToHex(parsed.r, parsed.g, parsed.b) : null;

  const applyRgb = (nextHex: string) => {
    const rgb = hexToRgb(nextHex);
    if (!rgb) return;
    const a = parsed?.a ?? 1;
    onChange(formatAsCss({ ...rgb, a: allowAlpha ? a : 1 }, allowAlpha));
  };

  const fallback = useMemo(() => parseCssColor(fallbackHex), [fallbackHex]);
  const displayHex =
    hexFromParsed ?? (fallback ? rgbToHex(fallback.r, fallback.g, fallback.b) : "#000000");

  const previewBg = previewBackground(value, displayHex, parsed, allowAlpha);
  const showChecker = !!(allowAlpha && parsed && parsed.a < 0.999);

  const alphaPct = parsed ? Math.round(parsed.a * 100) : 100;

  if (!parsed) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-text-secondary">{label}</label>
        <ColorSwatchTrigger
          displayHex={displayHex}
          previewBg={previewBg}
          showChecker={false}
          onPick={applyRgb}
          ariaLabel={`Escolher cor: ${label}`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-text-secondary">{label}</label>
      <ColorSwatchTrigger
        displayHex={displayHex}
        previewBg={previewBg}
        showChecker={showChecker}
        onPick={applyRgb}
        ariaLabel={`Escolher cor: ${label}`}
      />
      {allowAlpha ? (
        <div className="mt-2 border-t border-dark-border/50 pt-2">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-text-secondary">Opacidade</span>
            <span className="tabular-nums text-[11px] font-semibold text-shopee-orange/90">{alphaPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={alphaPct}
            onChange={(e) => {
              const nextA = clamp(Number(e.target.value) / 100, 0, 1);
              onChange(formatAsCss({ ...parsed, a: nextA }, true));
            }}
            className="h-2.5 w-full cursor-pointer accent-shopee-orange"
          />
        </div>
      ) : null}
    </div>
  );
}
