import { useEffect, useState } from 'react';

/**
 * Atrasa a propagacao de um valor que muda rapido.
 *
 * Usado na busca: sem isto, cada tecla dispara uma chamada IPC. Com 250 ms o
 * operador nao percebe atraso, e uma palavra digitada vira uma consulta em vez
 * de sete -- que e' o tipo de desperdicio que pesa no PC fraco.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
