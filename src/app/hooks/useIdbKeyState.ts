'use client'

import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';

/**
 * Hook (versão final aprimorada) que persiste estado no IndexedDB e 
 * informa o status de carregamento inicial.
 * @param key A chave única para armazenar o valor.
 * @param defaultValue O valor inicial.
 * @returns Uma tupla [valor, setValor, isLoading]
 */
export function useIdbKeyState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true); // Começa como true

  // Efeito para CARREGAR o valor do IndexedDB
  useEffect(() => {
    get(key).then(storedValue => {
      if (storedValue !== undefined) {
        setValue(storedValue);
      }
    }).catch(err => {
      console.error(`Erro ao carregar do IndexedDB com a chave "${key}":`, err);
    }).finally(() => {
      // Ao final, independentemente do resultado, o carregamento termina.
      setIsLoading(false); 
    });
  }, [key]);

  // Efeito para SALVAR o valor no IndexedDB
  useEffect(() => {
    // Não salva nada até que o carregamento inicial termine
    if (isLoading) {
      return;
    }
    set(key, value).catch(err => {
      console.error(`Erro ao salvar no IndexedDB com a chave "${key}":`, err);
    });
  }, [key, value, isLoading]);

  return [value, setValue, isLoading];
}