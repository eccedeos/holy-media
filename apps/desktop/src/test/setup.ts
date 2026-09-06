import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setLogLevel } from '@/lib/logger';

// Os testes exercitam caminhos de erro de proposito; o console fica limpo.
setLogLevel('silent');

afterEach(() => {
  cleanup();
});
