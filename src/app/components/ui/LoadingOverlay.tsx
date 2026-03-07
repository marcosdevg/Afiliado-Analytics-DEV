// app/components/ui/LoadingOverlay.tsx

'use client'

import { Loader2 } from "lucide-react"

type LoadingOverlayProps = {
  message?: string; // Mensagem opcional
}

export default function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    // Container principal que cobre a tela toda com fundo blur
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/40 backdrop-blur-sm">
      <div className="flex items-center gap-3 text-text-primary">
        {/* Ícone giratório */}
        <Loader2 className="h-6 w-6 animate-spin text-shopee-orange" />
        {/* Mensagem de carregamento */}
        <span className="text-lg font-medium">{message || 'Carregando...'}</span>
      </div>
    </div>
  )
}