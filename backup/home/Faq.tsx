'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'

const faqs = [
    { question: 'Preciso ter conhecimento técnico para usar a plataforma?', answer: 'Não! Nossa plataforma foi desenhada para ser extremamente intuitiva. Se você consegue baixar o relatório da Shopee, você consegue usar nossa ferramenta. Basta selecionar o arquivo e a mágica acontece.' },
    { question: 'Meus dados de vendas estão seguros?', answer: 'Sim. A segurança é nossa prioridade máxima. O processamento do seu arquivo é feito inteiramente no seu navegador. Seus dados de vendas nunca são enviados ou armazenados em nossos servidores.' },
    { question: 'Qual o tempo de garantia?', answer: 'Oferecemos uma garantia incondicional de 7 dias. Se por qualquer motivo você não ficar satisfeito com a ferramenta dentro desse período, basta solicitar o reembolso e devolveremos 100% do seu investimento, sem perguntas.' },
    { question: 'Posso cancelar minha assinatura a qualquer momento?', answer: 'Com certeza. Você tem total liberdade para cancelar sua assinatura quando quiser, sem burocracia. Ao cancelar, você continuará com acesso à plataforma até o final do seu período já pago.' },
    { question: 'Quais formatos de arquivo são suportados?', answer: 'Atualmente, é suportado o formato padrão de relatório de afiliados da Shopee, que geralmente é .CSV.' },
]

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="bg-dark-bg py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary font-heading md:text-4xl">
            Perguntas Frequentes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            Ainda tem dúvidas? Encontre aqui as respostas para as perguntas mais comuns.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-4xl space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="rounded-lg bg-dark-card">
              <button
                onClick={() => handleToggle(index)}
                className="flex w-full items-center justify-between p-6 text-left"
              >
                <span className="text-lg font-semibold text-text-primary font-heading">{faq.question}</span>
                <span className="ml-6 flex h-7 items-center text-shopee-orange">
                  {openIndex === index ? <Minus/> : <Plus/>}
                </span>
              </button>
              
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <div className="px-6 pb-6 pt-0 text-text-secondary">
                  <div className="border-l-2 border-shopee-orange/50 pl-4">
                    {faq.answer}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}