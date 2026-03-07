'use client'

import { CheckCircle, X } from 'lucide-react'

type InfoModalProps = {
  // 👇 1. REMOVIDA a prop 'title' que não era usada
  message: string
  onConfirm: () => void
}

// 👇 2. REMOVIDO o parâmetro 'title' da desestruturação
export default function InfoModal({ message, onConfirm }: InfoModalProps) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onConfirm}
    >
      <div 
        className="bg-dark-card rounded-lg p-8 pt-10 shadow-xl max-w-md w-full relative border border-dark-border text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onConfirm}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Fechar"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Corpo do Modal */}
        <div className="py-4">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          
          <p className="mt-4 text-lg font-semibold text-green-400">
            RECUPERAÇÃO DE SENHA ENVIADA!
          </p>

          <p className="mt-4 text-sm text-text-secondary leading-relaxed">
            {message}
          </p>
        </div>
        
        {/* Footer do Modal: Botão OK */}
        <div className="pt-4">
          <button
            onClick={onConfirm}
            className="w-full rounded-md border border-transparent bg-shopee-orange py-3 px-4 text-base font-bold text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}