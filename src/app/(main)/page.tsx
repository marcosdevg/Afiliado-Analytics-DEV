"use client";

import { useState, useEffect } from "react";
import Testimonials from "../components/home/Testimonials";
import Faq from "../components/home/Faq";
import Pricing from "../components/home/Pricing";
import {
  ArrowRight,
  BarChart,
  FileText,
  Link2,
  Zap,
  ChevronDown,
  Play,
} from "lucide-react";

import Link from "next/link";
import Image from "next/image";

const features = [
  {
    icon: <BarChart className="h-10 w-10 text-shopee-orange" />,
    title: "Análise de Comissões",
    description:
      "Visualize comissões, vendas e pedidos únicos com dashboards detalhados. Calcule ROI e CPA automaticamente.",
  },
  {
    icon: <Zap className="h-10 w-10 text-shopee-orange" />,
    title: "Análise de Cliques",
    description:
     "Rastreie cada clique dos seus links de afiliado e descubra quais produtos geram mais vendas.",
     
  },
  {
    icon: <Link2 className="h-10 w-10 text-shopee-orange" />,
    title: "Gestão de Links",
    description:
      "Gerencie campanhas com links personalizados e altere destinos a qualquer momento sem pausar suas divulgações.",
  },
  {
    icon: <FileText className="h-10 w-10 text-shopee-orange" />,
    title: "Calculadora GPL",
    description:
      "Calcule o Ganho por Lead automaticamente e projete sua receita mensal estimada.",
  },
];



export default function HomePage() {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = document.querySelector("section")?.clientHeight || 0;
      setShowWhatsApp(window.scrollY > heroHeight);
    };

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="bg-dark-bg text-text-secondary relative">
      {/* Seção Hero */}
      <section className="container mx-auto px-4 py-20 sm:py-28">
        <div className="text-center">
          {/* Título e subtítulo */}
          <h1 className="text-4xl font-extrabold tracking-tight text-text-primary font-heading sm:text-6xl">
            Transforme seus relatórios da Shopee em{" "}
            <span className="text-shopee-orange">insights inteligentes</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
            Pare de se perder em planilhas. Faça o upload do seu arquivo de vendas e veja gráficos e métricas claras sobre seu desempenho como afiliado.
          </p>

        {/* CTAs */}
<div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
  <Link
    href="#pricing"
    className="flex items-center justify-center gap-2 rounded-md bg-shopee-orange px-8 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90"
  >
    Ver Planos <ArrowRight className="h-5 w-5" />
  </Link>
  <button
    onClick={() => scrollToSection('demo')}
    className="flex items-center justify-center gap-2 rounded-md border-2 border-text-secondary/20 px-6 py-3 text-base font-semibold text-text-primary transition-colors hover:border-shopee-orange hover:text-shopee-orange"
  >
    <Play className="h-5 w-5" /> Ver na Prática
  </button>
</div>


          {/* Seta dupla */}
          <div className="mt-16 flex justify-center">
            <button
              onClick={() => scrollToSection("demo")}
              className="flex flex-col items-center"
              aria-label="Rolar para baixo"
            >
              <ChevronDown className="h-8 w-8 text-shopee-orange animate-bounce" />
              <ChevronDown className="h-8 w-8 text-shopee-orange -mt-4 animate-bounce" />
            </button>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE VÍDEO - TAMANHO REDUZIDO */}
      <section id="demo" className="container mx-auto px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-4xl">
          {/* Título da seção */}
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-text-primary font-heading md:text-4xl">
              Veja a Plataforma em Ação
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
              Descubra como é simples transformar seus dados em insights
              valiosos
            </p>
          </div>

          {/* Container responsivo do vídeo */}
          <div
            className="relative w-full overflow-hidden rounded-xl border border-dark-border bg-dark-card shadow-2xl transition-all duration-300 hover:border-shopee-orange hover:shadow-shopee-orange/20"
            style={{ paddingBottom: "56.25%" }}
          >
            <iframe
              className="absolute left-0 top-0 h-full w-full"
              src="https://www.youtube.com/embed/xGeHHUcIi64"
              title="Demonstração Afiliado Analytics"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Seção de Funcionalidades */}
      <section id="features" className="container mx-auto px-4 pb-16 sm:pb-24">
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary font-heading md:text-4xl">
            Tudo que você precisa para analisar suas vendas
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center rounded-lg border border-dark-border bg-dark-card p-8 text-center shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-shopee-orange"
            >
              <div className="rounded-full bg-dark-bg p-4">{feature.icon}</div>
              <h3 className="mt-6 font-semibold text-xl text-text-primary font-heading">
                {feature.title}
              </h3>
              <p className="mt-2 flex-grow text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <Testimonials />
      <Pricing />
      <Faq />

      {/* BOTÃO WHATSAPP */}
      {showWhatsApp && (
        <div className="fixed bottom-6 right-6 z-50">
          <a
            href="https://wa.me/5579999407366"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Fale conosco no WhatsApp"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => setIsExpanded(false)}
            className={`
              relative flex items-center
              bg-gradient-to-br from-[#25D366] to-[#128C7E]
              text-white rounded-full overflow-hidden
              transition-all duration-300 ease-out
              hover:shadow-2xl hover:scale-105
              active:scale-95
              focus:outline-none focus:ring-4 focus:ring-[#25D366]/50
              h-16
              ${prefersReducedMotion ? "" : "animate-fade-in"}
            `}
            style={{
              boxShadow: isExpanded
                ? "0 12px 28px rgba(37, 211, 102, 0.4)"
                : "0 8px 24px rgba(37, 211, 102, 0.3)",
              willChange: "transform",
              maxWidth: isExpanded ? "230px" : "64px",
              transition:
                "max-width 0.3s ease-out, box-shadow 0.3s ease-out, transform 0.3s ease-out",
            }}
          >
            <div className="flex items-center justify-center flex-shrink-0 w-16 h-16">
              <Image
                src="/iconewhatsapp.svg"
                alt="WhatsApp"
                width={32}
                height={32}
                className={`transition-transform duration-300 ${
                  isExpanded ? "scale-100" : "scale-110"
                }`}
                unoptimized
              />
            </div>

            <span
              className={`
                text-sm font-semibold whitespace-nowrap pr-5
                transition-all duration-300 ease-out
                ${
                  isExpanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 pointer-events-none"
                }
              `}
            >
              Fale conosco
            </span>
          </a>

          <div
            className={`
              absolute bottom-full right-0 mb-2
              bg-gray-800 text-white text-sm font-medium
              px-4 py-2 rounded-lg whitespace-nowrap
              shadow-xl
              transition-all duration-300 ease-out
              ${
                isExpanded && !prefersReducedMotion
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }
            `}
          >
            <div className="relative">
              Precisa de ajuda?
              <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-800" />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in {
            animation: none !important;
          }
          * {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
