// Este layout simplesmente renderiza o conteúdo da página sem adicionar NADA.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}