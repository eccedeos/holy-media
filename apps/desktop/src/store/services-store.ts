import { create } from 'zustand';
import type { AppError, Service, ServiceSummary } from '@holy-media/types';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import * as api from '@/lib/services-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('services');

/** Titulo padrao quando o operador adiciona uma musica sem ter aberto um culto. */
const DEFAULT_TITLE = 'Ordem do culto';

interface ServicesState {
  services: ServiceSummary[];
  /** O culto sendo montado/editado agora. `null` quando nenhum esta aberto. */
  active: Service | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: AppError | null;

  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  create: (title: string) => Promise<void>;
  rename: (title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearActive: () => void;

  /**
   * Acrescenta a musica ao culto ativo. Se nao houver culto aberto, cria um
   * com titulo padrao primeiro -- assim o operador nao precisa criar a ordem
   * do culto antes de poder usa-la; ela nasce no primeiro "adicionar".
   */
  addSong: (songId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  duplicateItem: (itemId: string) => Promise<void>;
  moveItem: (itemId: string, newPosition: number) => Promise<void>;
}

function toAppError(cause: unknown): AppError {
  return isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
}

export const useServicesStore = create<ServicesState>((set, get) => {
  const run = async (acao: () => Promise<Service>, nome: string) => {
    try {
      const active = await acao();
      set({ active, error: null });
      await get().refresh();
    } catch (cause) {
      const error = toAppError(cause);
      log.error('comando de ordem do culto falhou', { nome, code: error.code });
      set({ error });
    }
  };

  return {
    services: [],
    active: null,
    status: 'idle',
    error: null,

    refresh: async () => {
      set({ status: 'loading' });
      try {
        set({ services: await api.listServices(), status: 'ready', error: null });
      } catch {
        // Fora do Tauri nao ha lista a buscar; a secao fica vazia, sem
        // alarmar o operador com um erro que ele nao pode resolver. Mesma
        // convencao das outras stores (presentation, display).
        set({ status: 'ready', services: [] });
      }
    },

    select: async (id) => {
      try {
        set({ active: await api.getService(id), error: null });
      } catch (cause) {
        set({ error: toAppError(cause) });
      }
    },

    create: (title) => run(() => api.createService({ title }), 'criar'),

    rename: (title) => {
      const { active } = get();
      if (active === null) return Promise.resolve();
      return run(() => api.renameService(active.id, { title }), 'renomear');
    },

    remove: async (id) => {
      try {
        await api.deleteService(id);
        if (get().active?.id === id) set({ active: null });
        set({ error: null });
        await get().refresh();
      } catch (cause) {
        set({ error: toAppError(cause) });
      }
    },

    clearActive: () => set({ active: null }),

    addSong: async (songId) => {
      const { active } = get();
      if (active !== null) {
        await run(() => api.addSongToService(active.id, songId), 'adicionar musica');
        return;
      }
      try {
        const created = await api.createService({ title: DEFAULT_TITLE });
        await run(() => api.addSongToService(created.id, songId), 'adicionar musica');
      } catch (cause) {
        set({ error: toAppError(cause) });
      }
    },

    removeItem: (itemId) => {
      const { active } = get();
      if (active === null) return Promise.resolve();
      return run(() => api.removeServiceItem(active.id, itemId), 'remover item');
    },

    duplicateItem: (itemId) => {
      const { active } = get();
      if (active === null) return Promise.resolve();
      return run(() => api.duplicateServiceItem(active.id, itemId), 'duplicar item');
    },

    moveItem: (itemId, newPosition) => {
      const { active } = get();
      if (active === null) return Promise.resolve();
      return run(() => api.moveServiceItem(active.id, itemId, newPosition), 'mover item');
    },
  };
});

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetServicesStore(): void {
  useServicesStore.setState({ services: [], active: null, status: 'idle', error: null });
}
