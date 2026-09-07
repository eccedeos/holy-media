import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setLogLevel } from '@/lib/logger';

// Os testes exercitam caminhos de erro de proposito; o console fica limpo.
setLogLevel('silent');

afterEach(() => {
  cleanup();
  // Um teste que falha antes do seu proprio `useRealTimers` deixaria os
  // timers falsos ligados e faria todos os seguintes travar em timeout --
  // um erro apareceria como sete. Restaurar aqui isola a falha.
  vi.useRealTimers();
});
