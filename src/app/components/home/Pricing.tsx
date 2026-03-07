'use client'

import { Check, Percent } from 'lucide-react'
import Link from 'next/link'

// Links oficiais da Kiwify por plano (sem mudar preços ou lógica visual)
const plans = [
  { 
    name: 'Plano Mensal', 
    price: '67,90',
    kiwifyUrl: 'https://pay.kiwify.com.br/nUeOTJc',
    oldPrice: '81,00', 
    features: [ '1 mês de acesso completo', 'Dashboard com Métricas Chave', 'Análise de Cliques', 'Análise de Comissões','Site de Captura','Calculadora GPL' , '7 dias de Garantia',  ], 
    cta: 'Assinar Plano Mensal', 
    highlight: false, 
  },
  { 
    name: 'Plano Trimestral', 
    price: '179,90', 
    kiwifyUrl: 'https://pay.kiwify.com.br/OahBnEu', 
    oldPrice: '243,00', 
    features: [ '3 meses de acesso completo', 'Dashboard com Métricas Chave', 'Análise de Cliques', 'Análise de Comissões','Site de Captura','Calculadora GPL' , '7 dias de Garantia', ], 
    cta: 'Assinar Plano Trimestral', 
    highlight: true, 
  },
  { 
    name: 'Plano Anual', 
    price: '557,90', 
    kiwifyUrl: 'https://pay.kiwify.com.br/z1eiqbj', 
    oldPrice: '972,00', 
    features: [ '12 meses de acesso completo', 'Dashboard com Métricas Chave', 'Análise de Cliques', 'Análise de Comissões','Site de Captura','Calculadora GPL' , '7 dias de Garantia', ], 
    cta: 'Assinar Plano Anual', 
    highlight: false, 
  },
]

// Descontos fixos por plano (apenas visual; não altera preço)
const discountMap: Record<string, string> = {
  'Plano Mensal': '16% OFF',
  'Plano Trimestral': '26% OFF',
  'Plano Anual': '43% OFF',
}

export default function Pricing() {
  return (
    <section id="pricing" className="bg-dark-bg py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary font-heading md:text-4xl">
            Escolha o plano perfeito para você
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            Acesso completo a todas as funcionalidades em qualquer plano. Cancele quando quiser.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 items-center gap-8 lg:grid-cols-3 lg:gap-12">
          {plans.map((plan) => {
            const discount = discountMap[plan.name]

            return (
              <div
                key={plan.name}
                className={`group relative flex h-full flex-col rounded-2xl p-0.5 transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-shopee-orange/60 via-shopee-orange/20 to-transparent shadow-[0_0_50px_-20px_rgba(255,86,7,0.6)]'
                    : 'bg-gradient-to-b from-shopee-orange/20 via-transparent to-transparent'
                }`}
              >
                <div
                  className={`relative flex h-full flex-col rounded-2xl p-8 ${
                    plan.highlight
                      ? 'border-2 border-shopee-orange bg-dark-card ring-2 ring-shopee-orange/20'
                      : 'border border-dark-card bg-dark-card'
                  }`}
                >
                  {/* Ribbon diagonal para o plano destaque */}
                  {plan.highlight && discount && (
                    <div className="pointer-events-none absolute -right-12 top-6 rotate-45 bg-gradient-to-r from-shopee-orange to-orange-500 px-12 py-1 text-xs font-extrabold tracking-widest text-white shadow-lg">
                      {discount}
                    </div>
                  )}

                  {/* Badge superior para os demais planos */}
                  {!plan.highlight && discount && (
                    <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-full border border-shopee-orange/30 bg-shopee-orange/15 px-3 py-1 text-xs font-bold tracking-wide text-shopee-orange shadow">
                      <Percent className="h-3.5 w-3.5" />
                      {discount}
                    </div>
                  )}

                  <h3 className="text-center text-2xl font-semibold text-text-primary font-heading">{plan.name}</h3>
                  <div className="mt-6 text-center">
                    <span className="text-lg text-text-secondary/70 line-through">R$ {plan.oldPrice}</span>
                    <p><span className="text-5xl font-extrabold tracking-tight text-text-primary">R$ {plan.price}</span></p>
                  </div>

                  <ul className="mt-8 flex-grow space-y-4 text-sm text-text-secondary">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10 text-center">
                    <Link
                      href={plan.kiwifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block w-full rounded-md px-3 py-3 text-base font-semibold transition-all duration-300 ${
                        plan.highlight
                          ? 'bg-shopee-orange text-white shadow-lg shadow-shopee-orange/20 hover:brightness-110'
                          : 'border border-shopee-orange bg-transparent text-shopee-orange hover:bg-shopee-orange hover:text-white'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
