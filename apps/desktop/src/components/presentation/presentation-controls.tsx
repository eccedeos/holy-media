import { ChevronLeft, ChevronRight, Square, X } from 'lucide-react';
import { usePresentationStore } from '@/store/presentation-store';
import { Button } from '@/components/ui/button';
import { PresentationPreview } from './presentation-preview';

/**
 * Barra de comando da projecao.
 *
 * Todos os botoes refletem o motor: `canGoNext`/`canGoPrevious` vem do Rust, e
 * nao de uma conta refeita aqui. Se a regra de limite mudar, ela muda num lugar
 * so.
 */
export function PresentationControls() {
  const state = usePresentationStore((store) => store.state);
  const error = usePresentationStore((store) => store.error);
  const next = usePresentationStore((store) => store.next);
  const previous = usePresentationStore((store) => store.previous);
  const toggleBlackout = usePresentationStore((store) => store.toggleBlackout);
  const clear = usePresentationStore((store) => store.clear);

  const noAr = state.total > 0;

  return (
    <section
      aria-label="Controle da projecao"
      className="flex shrink-0 flex-col gap-3 border-b border-line p-3"
    >
      <PresentationPreview />

      <div className="min-h-[2.5rem]">
        {noAr ? (
          <>
            <p className="truncate text-sm font-medium">{state.title}</p>
            <p className="truncate text-xs text-content-muted">
              {state.label === '' ? `Slide ${state.index + 1}` : state.label}
              {' · '}
              {state.index + 1} de {state.total}
            </p>
          </>
        ) : (
          <p className="text-xs text-content-muted">Selecione uma musica e clique em Apresentar.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => void previous()}
          disabled={!state.canGoPrevious}
          aria-label="Slide anterior"
          className="flex-1"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>

        <Button
          variant={state.blackedOut ? 'live' : 'outline'}
          onClick={() => void toggleBlackout()}
          aria-pressed={state.blackedOut}
          className="flex-1"
        >
          <Square className="size-4" aria-hidden fill="currentColor" />
          Preto
        </Button>

        <Button
          variant="outline"
          onClick={() => void next()}
          disabled={!state.canGoNext}
          aria-label="Proximo slide"
          className="flex-1"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>

        <Button
          variant="ghost"
          onClick={() => void clear()}
          disabled={!noAr}
          aria-label="Tirar do ar"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {error !== null && (
        <p role="alert" className="text-xs text-live">
          {error.message}
        </p>
      )}
    </section>
  );
}
