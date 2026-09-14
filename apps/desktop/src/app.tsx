import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { isTauriAvailable } from '@/lib/ipc';
import { SongLibrary } from '@/components/songs/song-library';
import { SongPanel } from '@/components/songs/song-panel';
import { BibleNavigator } from '@/components/bible/bible-navigator';
import { BibleVerses } from '@/components/bible/bible-verses';
import { FreeTextPanel } from '@/components/text/free-text-panel';
import { QrPanel } from '@/components/qr/qr-panel';
import { PresentationControls } from '@/components/presentation/presentation-controls';
import { DisplayPicker } from '@/components/presentation/display-picker';
import { BackgroundSettings } from '@/components/presentation/background-settings';
import { KeyboardShortcutsPanel } from '@/components/presentation/keyboard-shortcuts-panel';
import { ServiceOrder } from '@/components/service/service-order';
import { usePresentationStore } from '@/store/presentation-store';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

type ContentTab = 'songs' | 'bible' | 'text' | 'qr';

const TAB_LABELS: Record<ContentTab, string> = {
  songs: 'Musicas',
  bible: 'Biblia',
  text: 'Texto',
  qr: 'QR Code',
};

/**
 * Control Room.
 *
 * Tres colunas: fonte de conteudo (musicas, Biblia, texto avulso ou QR Code,
 * por aba), detalhe do item selecionado, e a coluna do operador -- fundo,
 * projecao, previa e ordem do culto -- que fica montada sempre, porque
 * apresentar nao pode depender de qual aba de conteudo esta aberta.
 *
 * Texto avulso e QR Code nao tem nada para navegar na coluna da esquerda --
 * o formulario inteiro vive na coluna do meio, no lugar do detalhe.
 *
 * As quatro abas de conteudo ficam **sempre montadas**, so escondidas com
 * `hidden` -- nunca um `{tab === 'x' && <X />}` que desmonta. Foi assim que
 * um texto avulso digitado sumia ao trocar de aba e voltar: o componente
 * (com seu proprio `useState`) era destruido e recriado do zero. `hidden`
 * (propriedade do DOM, nao uma classe) tira o elemento do fluxo sem apagar
 * o estado do React por baixo.
 */
export function App() {
  const info = useAppStore((state) => state.info);
  const status = useAppStore((state) => state.status);
  const loadAppInfo = useAppStore((state) => state.loadAppInfo);
  const connect = usePresentationStore((store) => store.connect);
  const [tab, setTab] = useState<ContentTab>('songs');

  useKeyboardShortcuts();

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
            {(Object.keys(TAB_LABELS) as ContentTab[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                role="tab"
                aria-selected={tab === candidate}
                onClick={() => setTab(candidate)}
                className={cn(
                  'flex-1 px-3 py-2 font-medium uppercase tracking-wide',
                  tab === candidate
                    ? 'border-b-2 border-accent text-accent'
                    : 'text-content-muted hover:bg-surface-raised',
                )}
              >
                {TAB_LABELS[candidate]}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <div hidden={tab !== 'songs'} className="h-full">
              <SongLibrary />
            </div>
            <div hidden={tab !== 'bible'} className="h-full">
              <BibleNavigator />
            </div>
            <div hidden={tab !== 'text' && tab !== 'qr'} className="h-full">
              <p className="p-3 text-xs text-content-muted">
                Preencha o formulario na coluna do meio.
              </p>
            </div>
          </div>
        </div>
        <div className="min-h-0">
          <div hidden={tab !== 'songs'} className="h-full">
            <SongPanel />
          </div>
          <div hidden={tab !== 'bible'} className="h-full">
            <BibleVerses />
          </div>
          <div hidden={tab !== 'text'} className="h-full">
            <FreeTextPanel />
          </div>
          <div hidden={tab !== 'qr'} className="h-full">
            <QrPanel />
          </div>
        </div>
        {/* Coluna do operador: previa e comandos ficam sempre visiveis, para
            que avancar slide nunca dependa de qual aba de conteudo esta aberta. */}
        <div className="flex min-h-0 flex-col overflow-y-auto border-l border-line">
          <DisplayPicker />
          <BackgroundSettings />
          <PresentationControls />
          <KeyboardShortcutsPanel />
          <ServiceOrder />
        </div>
      </main>
    </div>
  );
}
