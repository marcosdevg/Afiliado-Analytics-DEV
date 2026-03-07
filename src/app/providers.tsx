'use client';

import React from 'react';
import '@/lib/chart-setup';

export function Providers({ children }: { children: React.ReactNode }) {
  // Importar o setup aqui garante execução apenas no cliente.
  return <>{children}</>;
}
