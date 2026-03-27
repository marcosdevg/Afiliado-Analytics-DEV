'use client'

import React from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { Star } from 'lucide-react'
import Image from 'next/image' // 👈 1. IMPORTAR O COMPONENTE IMAGE

const testimonials = [
  { name: 'Ana Silva', role: 'Afiliada Profissional', quote: 'Esta ferramenta transformou a maneira como analiso meus dados da Shopee. Finalmente consigo ver o que realmente funciona. Indispensável!', avatarUrl: 'https://i.imgur.com/PI9pFyt.png' },
  { name: 'Carlos Oliveira', role: 'Especialista em E-commerce', quote: 'Finalmente uma solução simples para um problema complexo. A visualização de dados é clara e me economiza horas de trabalho com planilhas.', avatarUrl: 'https://i.pravatar.cc/150?img=3' },
  { name: 'Juliana Pereira', role: 'Influenciadora Digital', quote: 'Consigo mostrar para meus parceiros, de forma visual e rápida, o resultado das minhas campanhas. A clareza dos gráficos é o ponto alto!', avatarUrl: 'https://i.pravatar.cc/150?img=5' },
  { name: 'Ricardo Mendes', role: 'Gestor de Tráfego', quote: 'A análise de comissões me ajudou a identificar quais canais de divulgação trazem mais retorno, otimizando meus investimentos em anúncios.', avatarUrl: 'https://i.pravatar.cc/150?img=7' },
  { name: 'Beatriz Costa', role: 'Iniciante em Afiliados', quote: 'Como iniciante, eu estava perdida. A plataforma me deu a clareza que eu precisava para entender minhas primeiras comissões e me motivar.', avatarUrl: 'https://i.imgur.com/Gat3J9V.png' }
]

export default function Testimonials() {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 4000, stopOnInteraction: false }),
  ])

  return (
    <section id="testimonials" className="bg-dark-card py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary font-heading md:text-4xl">
            O que nossos usuários dizem
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            Descubra como nossa plataforma está ajudando afiliados a otimizar seus resultados.
          </p>
        </div>
        
        <div className="embla mt-12 md:mt-16" ref={emblaRef}>
          <div className="embla__container">
            {testimonials.map((testimonial) => (
              <div className="embla__slide p-4" key={testimonial.name}>
                <div className="flex h-full flex-col rounded-lg bg-dark-bg p-8 shadow-sm">
                  <div className="flex gap-0.5 text-yellow-400">
                    {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-current" />)}
                  </div>
                  <blockquote className="mt-6 flex-grow text-text-secondary">
                    <p>“{testimonial.quote}”</p>
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-4">
                    {/* 👇 2. SUBSTITUIR <img> POR <Image> */}
                    <Image
                      className="h-12 w-12 rounded-full"
                      src={testimonial.avatarUrl}
                      alt={testimonial.name}
                      width={48}
                      height={48}
                    />
                    <div>
                      <div className="font-semibold text-text-primary font-heading">{testimonial.name}</div>
                      <div className="text-sm text-text-secondary">{testimonial.role}</div>
                    </div>
                  </figcaption>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}