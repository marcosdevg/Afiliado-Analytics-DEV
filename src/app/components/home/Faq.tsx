'use client'

import { useState } from 'react'
import { motion } from 'framer-motion' // 📦 Importando o Framer Motion

const FAQS = [
  {
    q: 'Preciso ter conhecimento técnico para usar a plataforma?',
    a: 'De forma alguma! A plataforma foi criada para simplificar a sua vida. Desde a criação de Páginas de Captura em minutos (sem código) até o nosso Gerador de Criativos com IA, tudo é intuitivo. Nossa ferramenta de Tráfego Inteligente (ATI) inclusive te diz se a sua performance está Ruim, Boa ou Excelente de forma visual.',
  },
  {
    q: 'Como a plataforma me ajuda a vender mais na Shopee?',
    a: 'Nosso arsenal cobre toda a jornada. Você pode gerar links rastreáveis com Sub IDs sem abrir o app, analisar minuciosamente a origem dos seus cliques, visualizar painéis detalhados de comissões e até criar links curtos que evitam bloqueios nas redes sociais. Tudo isso projetado para você entender o que funciona e escalar o que dá lucro.',
  },
  {
    q: 'Como funciona a ferramenta de Grupos de Venda?',
    a: 'É uma solução de automação focada em produtividade. Em vez de enviar mensagens manualmente, você gerencia suas listas de transmissão e programa disparos automáticos de ofertas para todos os seus grupos de WhatsApp de uma só vez, economizando horas do seu dia.',
  },
  {
    q: 'A Calculadora GPL funciona para quais tipos de campanha?',
    a: 'Ela é ideal para quem precisa ter controle absoluto do caixa. Com ela, você monitora o Custo Por Lead Real (CPL) e as saídas, descobrindo exatamente onde está o prejuízo e projetando sua receita real. Combinado com nosso recurso de Análise de Comissões, você passa a calcular seu ROI e CPA no automático.',
  },
  {
    q: 'Qual é o tempo de garantia da plataforma?',
    a: 'Você tem 7 dias de garantia incondicional. Você pode assinar, testar todas as 10 ferramentas (inclusive subir campanhas Meta direto do nosso painel) e, se achar que não ajudou a otimizar seus resultados, basta solicitar o cancelamento e devolvemos 100% do seu dinheiro, sem burocracia.',
  },
]

export default function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <section id="faq" className="relative overflow-hidden pt-12 pb-24 px-5 md:px-7 md:pt-[40px] md:pb-[100px]">
      {/* Background glow laranja para seguir o padrão do projeto */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.08)_0%,transparent_65%)] blur-[40px]" />

      <div className="relative mx-auto max-w-[760px] z-10">
        
        {/* ── HEADER DO FAQ (Animado) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-[60px] text-center"
        >
          <span className="mb-3.5 block font-['Inter'] text-xs font-bold uppercase tracking-[0.18em] text-[#fb923c]">
            Dúvidas Frequentes
          </span>

          <h2 className="mb-4 font-[var(--font-space-grotesk)] text-[clamp(1.9rem,5vw,3.2rem)] font-black leading-[1.1] tracking-[-1.5px] text-white">
            Tudo que você precisa{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">
              saber antes
            </span>
          </h2>

          <p className="mx-auto max-w-[440px] font-['Inter'] text-base leading-[1.7] text-white/60">
            Respondemos as principais objeções para que você tome a melhor decisão com total confiança.
          </p>
        </motion.div>

        {/* ── LISTA DE FAQS (Cascata animada) ── */}
        <div className="flex flex-col gap-2.5">
          {FAQS.map((faq, i) => {
            const open = openFaq === i

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: "easeOut" }} // Cascata: o delay multiplica pelo index
              >
                <div
                  onClick={() => setOpenFaq(open ? null : i)}
                  className={`
                    cursor-pointer overflow-hidden rounded-2xl transition-all duration-300
                    bg-white/5 backdrop-blur-md
                    ${open 
                      ? 'border border-[#e24c30]/45 shadow-[0_0_30px_rgba(226,76,48,0.12)]' 
                      : 'border border-white/10 hover:bg-white/10'}
                  `}
                >
                  {/* Pergunta (Cabeçalho do Acordeão) */}
                  <div className="flex items-center justify-between gap-4 p-5 md:px-6 md:py-[22px]">
                    <span className={`font-['Inter'] text-base font-bold leading-[1.4] flex-1 transition-colors duration-300 ${open ? 'text-white' : 'text-white/85'}`}>
                      {faq.q}
                    </span>

                    {/* Ícone de Mais/Menos */}
                    <div
                      className={`
                        flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-all duration-300
                        ${open 
                          ? 'bg-gradient-to-br from-[#e24c30] to-[#ff7a54] rotate-45 shadow-[0_4px_16px_rgba(226,76,48,0.4)]' 
                          : 'bg-white/10 rotate-0'}
                      `}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 2v8M2 6h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>

                  {/* Resposta (Conteúdo Acordeão) */}
                  <div
                    className="transition-all duration-300 ease-in-out"
                    style={{
                      maxHeight: open ? '250px' : '0px',
                      opacity: open ? 1 : 0,
                    }}
                  >
                    <div className="pb-[22px] px-5 md:px-6 font-['Inter'] text-[15px] leading-[1.8] text-white/60">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ── BOX DE SUPORTE (Animação com delay extra) ── */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }} // Aparece depois de todas as perguntas
          className="mt-10 rounded-[14px] border border-white/10 bg-white/5 p-5 text-center backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.22)]"
        >
          <p className="font-['Inter'] text-sm text-white/55">
            Ainda tem dúvidas?{' '}
            <a
              href="https://wa.me/5579999407366"
              className="font-bold text-[#fb923c] hover:underline transition-all"
            >
              Fale com nosso suporte em tempo real →
            </a>
          </p>
        </motion.div>
        
      </div>
    </section>
  )
}