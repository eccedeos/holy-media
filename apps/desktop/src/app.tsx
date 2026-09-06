import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { isTauriAvailable } from '@/lib/ipc';

/**
 * Casca da Fase 0.
 *
 * Ela existe para provar que a pilha esta de pe ponta a ponta: React renderiza,
 * Tailwind estiliza, Zustand guarda estado e o IPC alcanca o nucleo Rust. O
 * layout real do Control Room (biblioteca / preview / ordem do culto) e' a
 * primeira entrega da Fase 1.
 */
export function App() {
  const status = useAppStore((state) => state.status);
  const info = useAppStore((state) => state.info);
  const error = useAppStore((state) => state.error);
  const loadAppInfo = useAppStore((state) => state.loadAppInfo);

  useEffect(() => {
    void loadAppInfo();
  }, [loadAppInfo]);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Holy Media</h1>
        <p className="mt-1 text-sm text-[--color-content-muted]">
          Fase 0 &middot; fundacao do projeto
        </p>
      </header>

      <section
        aria-label="Estado do nucleo"
        className="w-full max-w-md rounded-lg border border-[--color-border-subtle] bg-[--color-surface-raised] p-5"
      >
        <h2 className="mb-3 text-sm font-medium text-[--color-content-muted]">Nucleo Rust</h2>

        {status === 'loading' && <p className="text-sm">Conectando...</p>}

        {status === 'ready' && info !== null && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-[--color-content-muted]">Aplicativo</dt>
            <dd>{info.name}</dd>
            <dt className="text-[--color-content-muted]">Versao</dt>
            <dd>{info.version}</dd>
            <dt className="text-[--color-content-muted]">Sistema</dt>
            <dd>{info.os}</dd>
            <dt className="text-[--color-content-muted]">Compilacao</dt>
            <dd>{info.debug ? 'debug' : 'release'}</dd>
          </dl>
        )}

        {status === 'error' && error !== null && (
          <p className="text-sm text-[--color-live]">{error.message}</p>
        )}

        {!isTauriAvailable() && (
          <p className="mt-3 text-xs text-[--color-content-muted]">
            Rodando no navegador: os recursos nativos ficam disponiveis apenas via{' '}
            <code>pnpm tauri:dev</code>.
          </p>
        )}
      </section>
    </main>
  );
}
