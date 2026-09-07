import { create } from 'zustand';
import type { AppError, Song, SongInput, SongSummary } from '@holy-media/types';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import * as api from '@/lib/songs-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('songs');

export type SongsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SongsState {
  /** Texto atual do campo de busca. */
  query: string;
  results: SongSummary[];
  status: SongsStatus;
  error: AppError | null;
  /** Musica aberta no painel de detalhe. */
  selected: Song | null;

  search: (query: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  clearSelection: () => void;
  create: (input: SongInput) => Promise<Song | null>;
  update: (id: string, input: SongInput) => Promise<Song | null>;
  remove: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
}

/**
 * Contador de requisicoes de busca.
 *
 * Sem isto ha uma corrida real: o operador digita "a" e depois "ab"; se a
 * resposta de "a" chegar depois da de "ab", a lista mostra o resultado errado
 * para o texto que esta na tela. Cada busca leva um numero, e so a mais recente
 * tem permissao de escrever no estado.
 */
let latestSearchId = 0;

function toAppError(cause: unknown): AppError {
  return isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
}

export const useSongsStore = create<SongsState>((set, get) => ({
  query: '',
  results: [],
  status: 'idle',
  error: null,
  selected: null,

  search: async (query) => {
    const searchId = ++latestSearchId;
    set({ query, status: 'loading', error: null });

    try {
      const results = await api.searchSongs(query);
      if (searchId !== latestSearchId) {
        // Uma busca mais nova ja saiu na frente; este resultado esta velho.
        return;
      }
      set({ results, status: 'ready' });
    } catch (cause) {
      if (searchId !== latestSearchId) return;
      const error = toAppError(cause);
      log.error('busca falhou', { query, code: error.code, detail: error.detail });
      set({ status: 'error', error, results: [] });
    }
  },

  select: async (id) => {
    try {
      set({ selected: await api.getSong(id), error: null });
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },

  clearSelection: () => set({ selected: null }),

  create: async (input) => {
    try {
      const song = await api.createSong(input);
      set({ selected: song, error: null });
      await get().search(get().query);
      return song;
    } catch (cause) {
      set({ error: toAppError(cause) });
      return null;
    }
  },

  update: async (id, input) => {
    try {
      const song = await api.updateSong(id, input);
      set({ selected: song, error: null });
      await get().search(get().query);
      return song;
    } catch (cause) {
      set({ error: toAppError(cause) });
      return null;
    }
  },

  remove: async (id) => {
    try {
      await api.deleteSong(id);
      // Fechar o detalhe apenas se era a musica excluida: apagar uma da lista
      // nao deve fechar outra que o operador esteja olhando.
      if (get().selected?.id === id) set({ selected: null });
      set({ error: null });
      await get().search(get().query);
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },

  toggleFavorite: async (id) => {
    try {
      const favorite = await api.toggleSongFavorite(id);
      // Atualiza no lugar em vez de refazer a busca: o operador clicou na
      // estrela, e a lista sumir ou reordenar debaixo do dedo seria pior.
      set((state) => ({
        results: state.results.map((song) => (song.id === id ? { ...song, favorite } : song)),
        selected: state.selected?.id === id ? { ...state.selected, favorite } : state.selected,
        error: null,
      }));
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },
}));

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetSongsStore(): void {
  latestSearchId = 0;
  useSongsStore.setState({
    query: '',
    results: [],
    status: 'idle',
    error: null,
    selected: null,
  });
}
