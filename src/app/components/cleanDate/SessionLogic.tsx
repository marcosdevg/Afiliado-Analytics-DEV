'use client'

import { useEffect } from 'react'
import { del } from 'idb-keyval'

// Chaves do IndexedDB que queremos limpar a cada nova sessão
const persistentKeysToClear = [
  'commissionsRawData_idb',
  'commissionsFileName_idb',
  'commissionsAdInvestment_idb',
  'gplCalculatorData_idb'  // ✅ Adiciona dados da Calculadora GPL
];

export default function SessionLogic() {
  useEffect(() => {
    const sessionMarker = 'session-active';

    if (!sessionStorage.getItem(sessionMarker)) {
      // Se o marcador NÃO existe, é uma NOVA SESSÃO.
      // Limpa cada uma das chaves que guardamos no IndexedDB
      Promise.all(persistentKeysToClear.map(key => del(key)))
        .catch(() => {
          // Em um ambiente de produção, um erro aqui não é crítico
          // e pode falhar silenciosamente. Opcionalmente, pode ser enviado
          // para um serviço de monitoramento de erros.
        });

      // Cria o marcador para a sessão atual
      sessionStorage.setItem(sessionMarker, 'true');
    }
  }, []); // O array vazio [] garante que este efeito rode apenas uma vez

  // Este componente não renderiza nada na tela
  return null;
}
