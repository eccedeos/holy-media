import { create } from 'zustand';
import type { AppError, AppInfo } from '@holy-media/types';
import { fetchAppInfo, isAppError, createAppError, describeUnknown } from '@/lib/ipc';

/**
 * Estado global minimo da Fase 0: apenas o resultado do handshake com o nucleo
 * Rust. Os dominios (musicas, Biblia, apresentacao) ganham suas proprias stores
 * nas fases em que forem implementados -- uma store por dominio, para que um
 * render de biblioteca nao dispare re-render do palco.
 */

export type CoreStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AppState {
  status: CoreStatus;
  info: AppInfo | null;
  error: AppError | null;
  loadAppInfo: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'idle',
  info: null,
  error: null,
  loadAppInfo: async () => {
    set({ status: 'loading', error: null });
    try {
      const info = await fetchAppInfo();
      set({ status: 'ready', info, error: null });
    } catch (cause) {
      const error = isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
      set({ status: 'error', error, info: null });
    }
  },
}));
