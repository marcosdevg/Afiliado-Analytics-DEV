"use client";

/** Slider com valor à direita — mesmo padrão do painel Em branco e secção promocional Rosa. */
export default function CaptureRangeField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (n: number) => string;
  onChange: (n: number) => void;
}) {
  const fmt = props.format ?? ((n: number) => `${n}px`);
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="block text-xs font-medium text-text-secondary">{props.label}</label>
        <span className="tabular-nums text-[11px] font-semibold text-shopee-orange/90">{fmt(props.value)}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="h-2.5 w-full cursor-pointer accent-shopee-orange"
      />
    </div>
  );
}
