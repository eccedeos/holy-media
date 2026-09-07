import { create } from 'zustand';
import type { AppError, DisplayState } from '@holy-media/types';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import * as api from '@/lib/display-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('display');

const VAZIO: DisplayState = { monitors: [], isOpen: false, monitorIndex: null };

interface DisplayStoreState {
  state: DisplayState;
  error: AppError | null;

  refresh: () => Promise<void>;
  open: (monitorIndex: number) => Promise<void>;
  close: () => Promise<void>;
}

function toAppError(cause: unknown): AppError {
  return isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
}

export const useDisplayStore = create<DisplayStoreState>((set) => {
  const run = async (acao: () => Promise<DisplayState>, nome: string) => {
    try {
      set({ state: await acao(), error: null });
    } catch (cause) {
      const error = toAppError(cause);
      log.error('comando de projecao falhou', { nome, code: error.code });
      set({ error });
    }
  };

  return {
    state: VAZIO,
    error: null,

    refresh: async () => {
      try {
        set({ state: await api.fetchDisplayState(), error: null });
      } catch {
        // Fora do Tauri nao ha monitores a listar, e nao ha nada que o
        // operador possa fazer: a secao fica vazia, sem erro na cara.
      }
    },
    open: (monitorIndex) => run(() => api.openDisplay(monitorIndex), 'abrir'),
    close: () => run(api.closeDisplay, 'fechar'),
  };
});

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetDisplayStore(): void {
  useDisplayStore.setState({ state: VAZIO, error: null });
}
