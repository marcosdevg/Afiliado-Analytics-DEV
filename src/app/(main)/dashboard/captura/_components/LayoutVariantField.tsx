"use client";

import { LayoutVariant } from "../_lib/types";

export default function LayoutVariantField(props: {
  value: LayoutVariant;
  onChange: (v: LayoutVariant) => void;
}) {
  const { value, onChange } = props;

  return (
    <div className="bg-dark-bg border border-dark-border rounded-md p-4">
      <div className="text-sm font-medium text-text-primary mb-2">Layout do card</div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="radio"
            name="layout_variant"
            value="icons"
            checked={value === "icons"}
            onChange={() => onChange("icons")}
          />
          Layout com Ícones
        </label>

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="radio"
            name="layout_variant"
            value="scarcity"
            checked={value === "scarcity"}
            onChange={() => onChange("scarcity")}
          />
          Layout com Escassez
        </label>
      </div>

      <div className="mt-2 text-xs text-text-secondary/80">
        A escolha afeta o conteúdo abaixo do título/descrição na página pública.
      </div>
    </div>
  );
}
