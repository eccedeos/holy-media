import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { isTauriAvailable } from '@/lib/ipc';
import { SongLibrary } from '@/components/songs/song-library';
import { SongPanel } from '@/components/songs/song-panel';
import { BibleNavigator } from '@/components/bible/bible-navigator';
import { BibleVerses } from '@/components/bible/bible-verses';
import { PresentationControls } from '@/components/presentation/presentation-controls';
import { DisplayPicker } from '@/components/presentation/display-picker';
import { ServiceOrder } from '@/components/service/service-order';
import { usePresentationStore } from '@/store/presentation-store';
import { cn } from '@/lib/utils';

type ContentTab = 'songs' | 'bible';

/**
 * Control Room.
 *
 * Tres colunas: fonte de conteudo (musicas ou Biblia, por aba), detalhe do
 * item selecionado, e a coluna do operador -- projecao, previa e ordem do
 * culto -- que fica montada sempre, porque apresentar nao pode depender de
 * qual aba de conteudo esta aberta.
 */
export function App() {
  const info = useAppStore((state) => state.info);
  const status = useAppStore((state) => state.status);
  const loadAppInfo = useAppStore((state) => state.loadAppInfo);
  const connect = usePresentationStore((store) => store.connect);
  const [tab, setTab] = useState<ContentTab>('songs');

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
        <div className="flex min-h-0 flex-col border-r border-line">
          <div role="tablist" className="flex shrink-0 border-b border-line text-xs">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'songs'}
              onClick={() => setTab('songs')}
              className={cn(
                'flex-1 px-3 py-2 font-medium uppercase tracking-wide',
                tab === 'songs'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-content-muted hover:bg-surface-raised',
              )}
            >
              Musicas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'bible'}
              onClick={() => setTab('bible')}
              className={cn(
                'flex-1 px-3 py-2 font-medium uppercase tracking-wide',
                tab === 'bible'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-content-muted hover:bg-surface-raised',
              )}
            >
              Biblia
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {tab === 'songs' ? <SongLibrary /> : <BibleNavigator />}
          </div>
        </div>
        <div className="min-h-0">{tab === 'songs' ? <SongPanel /> : <BibleVerses />}</div>
        {/* Coluna do operador: previa e comandos ficam sempre visiveis, para
            que avancar slide nunca dependa de qual aba de conteudo esta aberta. */}
        <div className="flex min-h-0 flex-col border-l border-line">
          <DisplayPicker />
          <PresentationControls />
          <ServiceOrder />
        </div>
      </main>
    </div>
  );
}
