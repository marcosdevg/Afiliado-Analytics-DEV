// app/hooks/useSessionStorageState.ts
'use client'

import { useState, useEffect } from 'react';

// Função auxiliar para obter o valor do sessionStorage de forma segura no cliente
function getStoredValue<T>(key: string, defaultValue: T): T {
  // Garante que este código só rode no navegador, onde sessionStorage existe
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const item = window.sessionStorage.getItem(key);
    // Se o item existir, parseia o JSON. Se não, retorna o valor padrão.
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Erro ao ler do sessionStorage com a chave "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Um custom hook que funciona como o useState, mas persiste o estado
 * no sessionStorage do navegador.
 * @param key A chave única para armazenar o valor no sessionStorage.
 * @param defaultValue O valor inicial a ser usado se nada for encontrado.
 * @returns Um par [estado, setEstado], igual ao useState.
 */
export function useSessionStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Inicializa o estado lendo do sessionStorage ou usando o valor padrão
  const [value, setValue] = useState<T>(() => {
    return getStoredValue(key, defaultValue);
  });

  // useEffect para salvar o estado no sessionStorage sempre que ele mudar
  useEffect(() => {
    // Garante que só rode no navegador
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Erro ao salvar no sessionStorage com a chave "${key}":`, error);
      }
    }
  }, [key, value]); // Roda sempre que a chave ou o valor mudarem

  return [value, setValue];
}