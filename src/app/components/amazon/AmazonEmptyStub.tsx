"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Placeholder visual usado em pontos antigos onde a versão ML mostrava o
 * `MlEmBreveSplash`. Para Amazon, mantemos o mesmo componente posicional
 * pra não quebrar o layout, mas ele sempre retorna `null` quando o usuário
 * tem direito ao recurso (controlado pelo `ProFeatureGate feature="amazon"`).
 *
 * Caso queira no futuro reaproveitar pra um banner "Beta", basta plugar
 * `AMAZON_UX_COMING_SOON` em `lib/amazon-ux-coming-soon.ts` como `true`.
 */
type Props = {
  showBack?: boolean;
  compact?: boolean;
  className?: string;
};

const EMBREVE_IMG_W = 1200;
const EMBREVE_IMG_H = 630;

export default function AmazonEmptyStub({
  showBack = true,
  compact = false,
  className = "",
}: Props) {
  const image = (
    <Image
      src="/embreve.png"
      alt="Em breve"
      width={EMBREVE_IMG_W}
      height={EMBREVE_IMG_H}
      className={[
        "h-auto w-full rounded-xl object-contain",
        compact ? "max-w-[min(100%,320px)]" : "max-w-3xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      sizes={compact ? "(max-width: 768px) 90vw, 320px" : "(max-width: 768px) 100vw, 768px"}
      priority={false}
    />
  );

  if (compact) return image;

  return (
    <div className="flex w-full flex-col items-center justify-center gap-6 py-6">
      {showBack ? (
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Voltar ao dashboard
        </Link>
      ) : null}
      {image}
    </div>
  );
}
