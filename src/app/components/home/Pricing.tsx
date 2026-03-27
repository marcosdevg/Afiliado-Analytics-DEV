'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'

const plans = [
  {
    name: 'Padrão',
    tagline: 'Ideal para quem está começando e quer validar seu processo.',
    price: '79,90',
    priceQuarterly: '69,30',
    cta: 'Comprar',
    valorMensal: 'https://pay.kiwify.com.br/Q1eE7t8',
    valorTrimestral: 'https://pay.kiwify.com.br/jGMeK6e',
    popular: false,
    tone: 'padrao',
    features: [
      'Análise de comissões',
      'Análise de cliques',
      'Redirecionador de Links',
      'Calculadora GPL Manual',
      'Gerador de links Shopee',
      'Grupo de Vendas: 1 grupo',
      'Site de captura: 1',
      'Instâncias conectadas: 1'
    ],
  },
  {
    name: 'Pro',
    tagline: 'Para afiliados que querem escalar com mais previsibilidade.',
    price: '297,90',
    priceQuarterly: '199,30',
    cta: 'Começar agora',
    valorMensal: 'https://pay.kiwify.com.br/4fAAtkD',
    valorTrimestral: 'https://pay.kiwify.com.br/TndnsLB',
    popular: true,
    tone: 'pro',
    features: [
      'Tudo do plano Padrão',
      'Tráfego Inteligente (ATI)',
      'Gerador de Criativo: 2 vídeos',
      'Custo Real de Leads do WhatsApp',
      'Criar campanha Meta',
      'Grupo de Vendas: 10 grupos',
      'Site de captura: 5',
      'Instâncias conectadas: 2'
    ],
  },
  {
    name: 'Personalizado',
    tagline: 'Para operações maiores que precisam de mais controle e suporte.',
    price: 'Sob consulta',
    cta: 'Falar com especialista',
    valorMensal: 'https://wa.me/5579999407366',
    valorTrimestral: 'https://wa.me/5579999407366',
    popular: false,
    tone: 'scale',
    features: [
      'Tudo do plano Pro',
      'Grupo de Vendas: Personalizdo',
      'Instâncias conectadas: Personalizado',
    ],
  },
]

export default function Pricing() {
  const [quarterly, setQuarterly] = useState(true)

  return (
    
    <section id="pricing" className="relative overflow-hidden px-[28px] py-10 sm:py-18">

      <div className="pointer-events-none absolute left-1/2 top-[30%] h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(124,58,237,0.12)_0%,transparent_65%)] blur-[40px]" />

      <div className="relative mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-[52px] text-center"
        >
          <span className="mb-[14px] block font-['Inter'] text-[12px] font-bold uppercase tracking-[0.18em] text-[#fb923c]">
            Investimento
          </span>

          <h2 className="mb-[16px] font-[var(--font-space-grotesk)] text-[clamp(1.9rem,5vw,3.4rem)] font-black leading-[1.1] tracking-[-1.5px] text-[#fff]">
            Planos que <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">cabem no seu bolso</span>
            <br />e nos seus resultados
          </h2>

          <p className="mx-auto mb-[32px] max-w-[440px] font-['Inter'] text-[17px] leading-[1.7] text-[rgba(255,255,255,0.6)]">
            Teste sem riscos. Você tem 7 dias de garantia incondicional ou seu dinheiro de volta.
          </p>

          <div className="inline-flex items-center gap-[16px] rounded-[50px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] px-[24px] py-[8px] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-[16px]">
            <span className={`font-['Inter'] text-[14px] font-semibold ${quarterly ? 'text-[rgba(255,255,255,0.4)]' : 'text-[#fff]'}`}>
              Mensal
            </span>

            <button
              onClick={() => setQuarterly(!quarterly)}
              className={`relative h-[28px] w-[48px] cursor-pointer rounded-[14px] border-none transition-colors duration-300 ${
                quarterly ? 'bg-[linear-gradient(135deg,#e24c30,#ff7a54)]' : 'bg-[rgba(255,255,255,0.15)]'
              }`}
            >
              <span
                className={`absolute top-[4px] block h-[20px] w-[20px] rounded-[50%] bg-[#fff] shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-all duration-300 ${
                  quarterly ? 'left-[calc(100%-24px)]' : 'left-[4px]'
                }`}
              />
            </button>

            <span className={`font-['Inter'] text-[14px] font-semibold ${quarterly ? 'text-[#fff]' : 'text-[rgba(255,255,255,0.4)]'}`}>
              Trimestral
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start gap-[22px]">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15, ease: "easeOut" }}
            >
              {plan.popular ? (
                <div className="relative rounded-[24px] bg-[linear-gradient(135deg,rgba(226,76,48,0.95)_0%,rgba(168,85,247,0.9)_52%,rgba(226,76,48,0.92)_100%)] p-[2px] shadow-[0_0_45px_rgba(226,76,48,0.18),0_0_90px_rgba(124,58,237,0.14)]">
                  <div className="relative overflow-hidden rounded-[22px] border border-[rgba(255,255,255,0.06)] bg-[#242431] px-[30px] py-[38px]">
                    <div className="pointer-events-none absolute inset-[1px] rounded-[21px] bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.006)_100%)]" />

                    <div className="pointer-events-none absolute -right-[80px] -top-[80px] h-[220px] w-[220px] rounded-[50%] bg-[radial-gradient(circle,rgba(226,76,48,0.16)_0%,transparent_70%)]" />
                    <div className="pointer-events-none absolute -bottom-[60px] -left-[60px] h-[180px] w-[180px] rounded-[50%] bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_70%)]" />
                    <div className="pointer-events-none absolute left-[18px] right-[18px] top-0 h-[1px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)]" />

                    <div className="absolute right-[20px] top-[20px] rounded-[50px] bg-[linear-gradient(135deg,#e24c30,#ff7a54)] px-[14px] py-[5px] font-['Inter'] text-[11px] font-extrabold tracking-[0.05em] text-[#fff] shadow-[0_8px_24px_rgba(226,76,48,0.28)]">
                      ⭐ MAIS POPULAR
                    </div>

                    <h3 className="relative mb-[6px] font-[var(--font-space-grotesk)] text-[31px] font-extrabold bg-[linear-gradient(90deg,#ffffff_0%,#ffd9cf_20%,#ffffff_40%,#ffffff_100%)] [background-size:220%_100%] bg-clip-text text-transparent [animation:shimmer_3s_linear_infinite]">
                      {plan.name}
                    </h3>

                    <p className="relative mb-[24px] font-['Inter'] text-[13px] text-[rgba(255,255,255,0.72)]">
                      {plan.tagline}
                    </p>

                    <div className="relative mb-[30px]">
                      <span className="font-[var(--font-space-grotesk)] text-[clamp(2.2rem,5vw,2.8rem)] font-black text-[#f7ebff]">
                        R$ {quarterly ? plan.priceQuarterly : plan.price}
                      </span>
                      <span className="ml-[4px] font-['Inter'] text-[14px] text-[#f7ebff]">
                        /mês
                      </span>
                      {quarterly && (
                        <>
                          <p className="mt-[2px] font-['Inter'] text-[15px] text-[rgba(255, 255, 255, 0.72)]">
                            (R$ 597,90)
                          </p>
                          <p className="mt-[4px] font-['Inter'] text-[12px] text-[rgba(255, 255, 255, 0.67)]">
                            Economia de 295,80 (33,1%)
                          </p>
                        </>
                      )}
                    </div>

                    <a
                      href={quarterly ? plan.valorTrimestral : plan.valorMensal}
                      className="relative mb-[28px] block rounded-[14px] bg-[linear-gradient(135deg,#e24c30,#ff7a54)] py-[15px] text-center font-['Inter'] text-[16px] font-extrabold text-[#fff] shadow-[0_10px_28px_rgba(226,76,48,0.35)] no-underline transition-all duration-[220ms] ease-in hover:-translate-y-[3px]"
                    >
                      {plan.cta}
                    </a>

                    <p className="relative mb-[14px] font-['Inter'] text-[11px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.8)]">
                      Incluso:
                    </p>

                    <ul className="relative m-0 flex list-none flex-col gap-[11px] p-0">
                      {plan.features.map((ft, j) => (
                        <li key={j} className="flex gap-[10px] font-['Inter'] text-[14px] text-[rgba(255,255,255,0.88)]">
                          <span className="mt-[1px] shrink-0 font-black text-[#fb923c]">✓</span>
                          {ft}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div
                  className={`
                    group relative overflow-hidden rounded-[22px] border px-[30px] py-[30px] backdrop-blur-[16px] transition-all duration-300 ease-in hover:-translate-y-[6px] hover:border-[rgba(255,255,255,0.16)] hover:shadow-[0_24px_50px_rgba(0,0,0,0.35)] shadow-[0_10px_40px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.03)]
                    ${plan.tone === 'padrao'
                      ? 'border-[rgba(168,85,247,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.065)_0%,rgba(44,28,78,0.18)_100%)]'
                      : 'border-[rgba(34,211,238,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.065)_0%,rgba(31,63,89,0.14)_100%)]'
                    }
                    ${plan.tone === 'scale' ? 'min-h-[628px]' : ''}
                  `}
                >
                  <div
                    className={`pointer-events-none absolute left-[18px] right-[18px] top-0 h-[2px] rounded-[999px] ${
                      plan.tone === 'padrao'
                        ? 'bg-[linear-gradient(90deg,rgba(168,85,247,0),rgba(168,85,247,0.55),rgba(226,76,48,0.18),rgba(168,85,247,0))]'
                        : 'bg-[linear-gradient(90deg,rgba(6,182,212,0),rgba(6,182,212,0.45),rgba(168,85,247,0.15),rgba(6,182,212,0))]'
                    }`}
                  />
                  <div
                    className={`pointer-events-none absolute -right-[40px] -top-[60px] h-[140px] w-[140px] rounded-[50%] ${
                      plan.tone === 'padrao'
                        ? 'bg-[radial-gradient(circle,rgba(168,85,247,0.10)_0%,transparent_70%)]'
                        : 'bg-[radial-gradient(circle,rgba(6,182,212,0.08)_0%,transparent_70%)]'
                    }`}
                  />

                  <h3 className="relative mb-[6px] font-[var(--font-space-grotesk)] text-[20px] font-extrabold text-[#fff]">
                    {plan.name}
                  </h3>

                  <p className="relative mb-[22px] font-['Inter'] text-[13px] text-[rgba(255,255,255,0.7)]">
                    {plan.tagline}
                  </p>

                  <div className="relative mb-[26px]">
                    {plan.tone === 'scale' ? (
                      <span className="font-[var(--font-space-grotesk)] text-[clamp(1.6rem,4vw,2rem)] font-black text-[#fff]">
                        {plan.price}
                      </span>
                    ) : (
                      <>
                        <span className="font-[var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.4rem)] font-black text-[#fff]">
                          R$ {quarterly ? plan.priceQuarterly : plan.price}
                        </span>
                        <span className="ml-[4px] font-['Inter'] text-[14px] text-[rgba(255, 255, 255, 0.69)]">
                          /mês
                        </span>
                        {quarterly && (
                          <>
                            <p className="mt-[2px] font-['Inter'] text-[15px] text-[rgba(255, 255, 255, 0.72)]">
                              (R$ 207,90)
                            </p>
                            <p className="mt-[4px] font-['Inter'] text-[12px] text-[rgba(255, 255, 255, 0.67)]">
                              Economia de 31,80 (13,2%)
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <a
                    href={quarterly ? plan.valorTrimestral : plan.valorMensal}
                    className={`
                      relative mb-[26px] block rounded-[12px] border py-[13px] text-center font-['Inter'] text-[15px] font-bold text-[#fff] no-underline transition-all duration-[220ms] ease-in hover:-translate-y-[3px] hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.14)]
                      ${plan.tone === 'padrao'
                        ? 'border-[rgba(168,85,247,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(168,85,247,0.08)_100%)]'
                        : 'border-[rgba(6,182,212,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(6,182,212,0.06)_100%)]'
                      }
                    `}
                  >
                    {plan.cta}
                  </a>

                  <div className="relative border-t border-[rgba(255,255,255,0.08)] pt-[22px]">
                    <p className="mb-[14px] font-['Inter'] text-[11px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.8)]">
                      Incluso:
                    </p>

                    <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                      {plan.features.map((ft, j) => (
                        <li key={j} className="flex gap-[10px] font-['Inter'] text-[13.5px] text-[rgba(255,255,255,0.84)]">
                          <span className={`mt-[1px] shrink-0 font-black ${plan.tone === 'padrao' ? 'text-[rgba(168,85,247,0.72)]' : 'text-[rgba(6,182,212,0.68)]'}`}>
                            ✓
                          </span>
                          {ft}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
          className="mx-auto mt-[40px] md:mt-[52px] max-w-[580px] rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.03)_100%)] p-[28px_24px] text-center shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-[16px]"
        >
          <div className="mx-auto mb-[12px] flex h-[88px] w-[88px] items-center justify-center">
            <Image
              src="/7days.png"
              alt="Selo de garantia de 7 dias — satisfação garantida, risco zero"
              width={120}
              height={120}
              className="object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
            />
          </div>

          <h4 className="mb-[8px] font-[var(--font-space-grotesk)] text-[17px] font-extrabold text-[#fff]">
            Garantia Incondicional de 7 Dias
          </h4>

          <p className="font-['Inter'] text-[14px] leading-[1.7] text-[rgba(255,255,255,0.55)]">
            Não ficou satisfeito? Devolvemos 100% sem burocracia, sem perguntas. O risco é todo nosso.
          </p>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -20% 0; }
        }
      `}} />
    </section>
  )
}