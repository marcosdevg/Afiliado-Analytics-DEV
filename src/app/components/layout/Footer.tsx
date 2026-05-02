export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    // Fundo e borda superior agora usam as cores do nosso tema
    <footer className="bg-dark-bg border-t border-dark-border">
      <div className="container mx-auto px-4 py-6 text-center text-sm">
        {/* Texto com a cor secundária do tema e uma leve opacidade para ficar mais sutil, 
          uma prática comum em rodapés.
        */}
        <p className="text-text-secondary/70">&copy; {currentYear} Afiliado Analytics. Todos os direitos reservados.</p>
        <p className="text-text-secondary/70 text-[10px] mt-1">
          Desenvolvido por{" "}
          <a
            href="https://codenxt.online"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            CODENXT
          </a>
        </p>
      </div>
    </footer>
  )
}