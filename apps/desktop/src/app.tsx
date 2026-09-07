import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { isTauriAvailable } from '@/lib/ipc';
import { SongLibrary } from '@/components/songs/song-library';
import { SongDetail } from '@/components/songs/song-detail';

/**
 * Control Room.
 *
 * O layout definitivo tem tres colunas -- biblioteca, preview e ordem do culto.
 * Duas existem: a biblioteca (funcional) e o detalhe da musica, que dara' lugar
 * ao preview quando o Presentation Engine chegar. A ordem do culto entra no
 * passo dela, na Fase 1.
 */
export function App() {
  const info = useAppStore((state) => state.info);
  const status = useAppStore((state) => state.status);
  const loadAppInfo = useAppStore((state) => state.loadAppInfo);

  useEffect(() => {
    void loadAppInfo();
  }, [loadAppInfo]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[--color-border-subtle] px-4 py-2">
        <h1 className="text-sm font-semibold tracking-tight">Holy Media</h1>
        <p className="text-xs text-[--color-content-muted]">
          {status === 'ready' && info !== null
            ? `v${info.version}`
            : isTauriAvailable()
              ? 'Conectando ao nucleo...'
              : 'Modo navegador: a biblioteca precisa do aplicativo instalado'}
        </p>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(260px,340px)_1fr]">
        <div className="min-h-0 border-r border-[--color-border-subtle]">
          <SongLibrary />
        </div>
        <div className="min-h-0">
          <SongDetail />
        </div>
      </main>
    </div>
  );
}
