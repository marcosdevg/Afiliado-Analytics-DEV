'use client'

import React, { useCallback } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import Image from 'next/image'
import { motion } from 'framer-motion' // 📦 Importando o Framer Motion

const testimonials = [
  {
    name: 'Ana Silva',
    role: 'Afiliada Profissional',
    quote:
      'Automatizar ofertas no WhatsApp e saber meu lucro exato por lead mudou o jogo. A Calculadora GPL é surreal!',
    avatarUrl: 'https://i.imgur.com/PI9pFyt.png',
    c1: '#ff6b35',
    c2: '#e24c30',
  },
  {
    name: 'Carlos Oliveira',
    role: 'Especialista em E-commerce',
    quote:
      'O termômetro da ATIA me fez parar de queimar dinheiro. Ele cruza Meta e Shopee e diz na hora qual criativo escalar.',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    c1: '#7c3aed',
    c2: '#a855f7',
  },
  {
    name: 'Juliana Pereira',
    role: 'Influenciadora Digital',
    quote:
      'Fim do trabalho manual. Agora eu gerencio minhas listas e disparo ofertas para os meus grupos de WhatsApp no piloto automático.',
    avatarUrl: 'https://i.pravatar.cc/150?img=5',
    c1: '#06b6d4',
    c2: '#3b82f6',
  },
  {
    name: 'Ricardo Mendes',
    role: 'Gestor de Tráfego',
    quote:
      'Escalar campanhas ficou muito mais seguro. A ATIA valida meus anúncios e a Calculadora GPL me dá o teto exato por clique.',
    avatarUrl: 'https://i.pravatar.cc/150?img=7',
    c1: '#f97316',
    c2: '#fb923c',
  },
  {
    name: 'Beatriz Costa',
    role: 'Iniciante em Afiliados',
    quote:
      'Ficar travada sem programador, nunca mais. Agora crio minhas próprias páginas de captura de alta conversão em minutos.',
    avatarUrl: 'https://i.imgur.com/Gat3J9V.png',
    c1: '#14b8a6',
    c2: '#22c55e',
  },
]

function Stars() {
  return (
    <div className="flex gap-[3px]">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 20 20" fill="#fb923c">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function Testimonials() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000, stopOnInteraction: false }),
  ])

  const handleMouseEnter = useCallback(() => {
    if (emblaApi) emblaApi.plugins().autoplay.stop()
  }, [emblaApi])

  const handleMouseLeave = useCallback(() => {
    if (emblaApi) emblaApi.plugins().autoplay.play()
  }, [emblaApi])

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden bg-[#18181B] py-10 sm:py-18"
    >
      {/* Glows */}
      <div className="pointer-events-none absolute left-[5%] top-[15%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.08)_0%,transparent_65%)] blur-[40px]" />
      <div className="pointer-events-none absolute bottom-[10%] right-[10%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.08)_0%,transparent_65%)] blur-[40px]" />

      <div className="container relative mx-auto px-4">
        
        {/* ── HEADER DA SEÇÃO COM ANIMAÇÃO ── */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-[68px] text-center"
        >
          <span className="mb-[14px] block font-['Inter'] text-[12px] font-bold uppercase tracking-[0.18em] text-[#fb923c]">
            Prova Social
          </span>

          <h2 className="mb-[16px] font-[var(--font-space-grotesk)] text-[clamp(1.9rem,5vw,3.4rem)] font-black leading-[1.1] tracking-[-1.5px] text-white">
            Afiliados reais. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">Resultados reais.</span>
          </h2>

          <p className="mx-auto max-w-[500px] font-['Inter'] text-[17px] leading-[1.6] text-white/60">
            Milhares de afiliados já transformaram sua operação com a Afiliado Analytics. Veja o que eles dizem.
          </p>
        </motion.div>

        {/* ── CARROSSEL COM ANIMAÇÃO NO CONTAINER ── */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="embla mt-12 md:mt-16" 
          ref={emblaRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="embla__container flex">
            {testimonials.map((testimonial) => (
              <div className="embla__slide p-4 flex-[0_0_100%] min-w-0 md:flex-[0_0_50%] lg:flex-[0_0_33.333%]" key={testimonial.name}>
                
                {/* ── CARD ── */}
                <div
                  className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#23232A] p-8 shadow-sm transition-all duration-300 ease-out hover:-translate-y-[6px] hover:border-[#e24c30]/35 hover:shadow-[0_24px_50px_rgba(0,0,0,0.35),0_0_0_1px_rgba(226,76,48,0.18)]"
                >
                  <div
                    className="absolute left-0 top-0 h-[3px] w-full"
                    style={{
                      background: `linear-gradient(90deg, ${testimonial.c1}, ${testimonial.c2})`,
                    }}
                  />

                  <div className="flex items-center gap-4">
                    <div
                      className="rounded-full p-[2px]"
                      style={{
                        background: `linear-gradient(135deg, ${testimonial.c1}, ${testimonial.c2})`,
                        boxShadow: `0 4px 18px ${testimonial.c1}40`,
                      }}
                    >
                      <Image
                        className="h-12 w-12 rounded-full object-cover"
                        src={testimonial.avatarUrl}
                        alt={testimonial.name}
                        width={48}
                        height={48}
                      />
                    </div>

                    <div>
                      <div className="font-['Inter'] text-[14.5px] font-bold text-white">
                        {testimonial.name}
                      </div>
                      <div className="font-['Inter'] text-[12px] text-white/45">
                        {testimonial.role}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Stars />
                  </div>

                  <blockquote className="mt-[24px] flex-grow font-['Inter'] text-[14.5px] leading-[1.75] text-white/65">
                    <p>“{testimonial.quote}”</p>
                  </blockquote>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}