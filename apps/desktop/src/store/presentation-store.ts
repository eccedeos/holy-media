import { create } from 'zustand';
import type { AppError, PresentationState } from '@holy-media/types';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import * as api from '@/lib/presentation-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('presentation');

/**
 * Espelho do motor que vive no Rust.
 *
 * Esta store **nao decide nada**: ela guarda o ultimo estado que o nucleo
 * mandou. Toda a regra (limites, tela preta, posicao) esta no motor, e' testada
 * la, e vale igual para o Control Room, para a segunda tela e, na Fase 3, para
 * o celular. Duplicar a logica aqui seria criar uma segunda verdade.
 */

/** Estado inicial antes da primeira resposta do nucleo. */
const VAZIO: PresentationState = {
  output: { kind: 'idle' },
  sourceId: null,
  title: '',
  label: '',
  index: 0,
  total: 0,
  blackedOut: false,
  canGoNext: false,
  canGoPrevious: false,
};

interface PresentationStoreState {
  state: PresentationState;
  error: AppError | null;

  /** Busca o estado atual e passa a escutar as mudancas. */
  connect: () => Promise<() => void>;
  present: (songId: string) => Promise<void>;
  presentBible: (translationId: string, reference: string) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  first: () => Promise<void>;
  last: () => Promise<void>;
  goTo: (index: number) => Promise<void>;
  toggleBlackout: () => Promise<void>;
  clear: () => Promise<void>;
}

function toAppError(cause: unknown): AppError {
  return isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
}

export const usePresentationStore = create<PresentationStoreState>((set) => {
  /** Aplica um comando e guarda o estado devolvido. */
  const run = async (acao: () => Promise<PresentationState>, nome: string) => {
    try {
      set({ state: await acao(), error: null });
    } catch (cause) {
      const error = toAppError(cause);
      log.error('comando de apresentacao falhou', { nome, code: error.code });
      set({ error });
    }
  };

  return {
    state: VAZIO,
    error: null,

    connect: async () => {
      // O evento chega quando qualquer janela muda o motor; sem ele, duas
      // janelas mostrariam estados diferentes do mesmo culto.
      //
      // Assinar e buscar sao independentes de proposito: se a assinatura
      // falhar, o estado inicial ainda precisa chegar. Foi assim que a janela
      // de projecao ficou preta uma vez -- a assinatura estourava e levava o
      // estado inicial junto, entao a tela nunca mostrava o slide.
      let unlisten: () => void = () => {};
      try {
        unlisten = await api.onPresentationState((state) => set({ state }));
      } catch (cause) {
        log.error('nao foi possivel escutar o motor', { detail: describeUnknown(cause) });
      }

      try {
        set({ state: await api.fetchPresentationState(), error: null });
      } catch {
        // Fora do Tauri nao ha nucleo: a tela fica no estado de espera, sem
        // alarmar o operador com um erro que ele nao pode resolver.
      }

      return unlisten;
    },

    present: (songId) => run(() => api.presentSong(songId), 'apresentar'),
    presentBible: (translationId, reference) =>
      run(() => api.presentBibleReference(translationId, reference), 'apresentar biblia'),
    next: () => run(api.presentationNext, 'proximo'),
    previous: () => run(api.presentationPrevious, 'anterior'),
    first: () => run(api.presentationFirst, 'primeiro'),
    last: () => run(api.presentationLast, 'ultimo'),
    goTo: (index) => run(() => api.presentationGoTo(index), 'ir para'),
    toggleBlackout: () => run(api.presentationToggleBlackout, 'tela preta'),
    clear: () => run(api.presentationClear, 'limpar'),
  };
});

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetPresentationStore(): void {
  usePresentationStore.setState({ state: VAZIO, error: null });
}
