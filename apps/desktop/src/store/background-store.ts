import { create } from 'zustand';
import type { AppError, BackgroundInput, BackgroundSettings } from '@holy-media/types';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import * as api from '@/lib/background-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('background');

/**
 * Espelho do fundo que vive no Rust.
 *
 * Mesma filosofia da `presentation-store`: esta store nao decide nada, so
 * guarda o ultimo fundo que o nucleo confirmou. A tela de projecao e a previa
 * renderizam o mesmo `settings`, para a previa nunca mentir sobre o fundo real.
 */

const PRETO: BackgroundSettings = {
  kind: 'color',
  color: '#000000',
  gradientFrom: null,
  gradientTo: null,
  gradientAngle: null,
  imageData: null,
};

interface BackgroundStoreState {
  settings: BackgroundSettings;
  error: AppError | null;

  /** Busca o fundo atual e passa a escutar as mudancas. */
  connect: () => Promise<() => void>;
  setColor: (color: string) => Promise<void>;
  setGradient: (from: string, to: string, angle: number) => Promise<void>;
  setImage: (dataUrl: string) => Promise<void>;
}

function toAppError(cause: unknown): AppError {
  return isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
}

export const useBackgroundStore = create<BackgroundStoreState>((set) => {
  const set_ = async (input: BackgroundInput) => {
    try {
      set({ settings: await api.setBackground(input), error: null });
    } catch (cause) {
      const error = toAppError(cause);
      log.error('nao foi possivel trocar o fundo', { code: error.code });
      set({ error });
    }
  };

  return {
    settings: PRETO,
    error: null,

    connect: async () => {
      let unlisten: () => void = () => {};
      try {
        unlisten = await api.onBackgroundChanged((settings) => set({ settings }));
      } catch (cause) {
        log.error('nao foi possivel escutar o fundo', { detail: describeUnknown(cause) });
      }

      try {
        set({ settings: await api.fetchBackgroundSettings(), error: null });
      } catch {
        // Fora do Tauri nao ha nucleo: o fundo fica no padrao (preto), sem
        // alarmar o operador com um erro que ele nao pode resolver.
      }

      return unlisten;
    },

    setColor: (color) => set_({ kind: 'color', color }),
    setGradient: (from, to, angle) =>
      set_({ kind: 'gradient', gradientFrom: from, gradientTo: to, gradientAngle: angle }),
    setImage: (dataUrl) => set_({ kind: 'image', imageData: dataUrl }),
  };
});

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetBackgroundStore(): void {
  useBackgroundStore.setState({ settings: PRETO, error: null });
}
