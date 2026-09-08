import { useEffect } from 'react';
import { useAppStore } from '@/store/app-store';
import { isTauriAvailable } from '@/lib/ipc';
import { SongLibrary } from '@/components/songs/song-library';
import { SongPanel } from '@/components/songs/song-panel';
import { PresentationControls } from '@/components/presentation/presentation-controls';
import { DisplayPicker } from '@/components/presentation/display-picker';
import { ServiceOrder } from '@/components/service/service-order';
import { usePresentationStore } from '@/store/presentation-store';

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
  const connect = usePresentationStore((store) => store.connect);

  useEffect(() => {
    void loadAppInfo();
  }, [loadAppInfo]);

  useEffect(() => {
    // `connect` devolve o cancelamento da assinatura do evento. Sem cancelar,
    // um recarregamento da interface deixaria ouvintes acumulados.
    const pendente = connect();
    return () => {
      void pendente.then((unlisten) => unlisten());
    };
  }, [connect]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
        <h1 className="text-sm font-semibold tracking-tight">Holy Media</h1>
        <p className="text-xs text-content-muted">
          {status === 'ready' && info !== null
            ? `v${info.version}`
            : isTauriAvailable()
              ? 'Conectando ao nucleo...'
              : 'Modo navegador: a biblioteca precisa do aplicativo instalado'}
        </p>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(240px,300px)_1fr_minmax(260px,320px)]">
        <div className="min-h-0 border-r border-line">
          <SongLibrary />
        </div>
        <div className="min-h-0">
          <SongPanel />
        </div>
        {/* Coluna do operador: previa e comandos ficam sempre visiveis, para
            que avancar slide nunca dependa de rolar ou trocar de aba. A ordem
            do culto ocupa o espaco abaixo quando chegar. */}
        <div className="flex min-h-0 flex-col border-l border-line">
          <DisplayPicker />
          <PresentationControls />
          <ServiceOrder />
        </div>
      </main>
    </div>
  );
}
