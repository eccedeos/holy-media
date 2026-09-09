import { create } from 'zustand';
import type {
  AppError,
  BibleBook,
  BibleImportInput,
  BibleReferenceResult,
  BibleTranslation,
  BibleVerse,
  BibleVerseMatch,
} from '@holy-media/types';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import * as api from '@/lib/bible-api';
import { createLogger } from '@/lib/logger';

const log = createLogger('bible');

/**
 * O que a coluna do meio esta mostrando: capitulo navegado manualmente,
 * resultado de busca por palavra, ou uma referencia resolvida ("João 3:16").
 */
export type BibleMode = 'browse' | 'search' | 'reference';

interface BibleState {
  translations: BibleTranslation[];
  translationId: string | null;
  books: BibleBook[];
  bookId: string | null;
  chapter: number | null;
  chapterVerses: BibleVerse[];
  query: string;
  mode: BibleMode;
  searchResults: BibleVerseMatch[];
  reference: BibleReferenceResult | null;
  error: AppError | null;

  refreshTranslations: () => Promise<void>;
  selectTranslation: (id: string) => Promise<void>;
  selectBook: (id: string) => Promise<void>;
  selectChapter: (chapter: number) => Promise<void>;
  /** Uma so' caixa: tenta como referencia ("João 3:16") e cai para busca por
   * palavra quando o texto nao e' uma referencia valida. */
  search: (query: string) => Promise<void>;
  importTranslation: (input: BibleImportInput) => Promise<void>;
  deleteTranslation: (id: string) => Promise<void>;
}

/**
 * Contador de buscas, pelo mesmo motivo do equivalente em `songs-store`: sem
 * ele, a resposta de uma busca antiga que volta depois de uma mais nova
 * sobrescreveria o resultado certo com um errado.
 */
let latestSearchId = 0;

function toAppError(cause: unknown): AppError {
  return isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
}

const VAZIO = {
  translations: [] as BibleTranslation[],
  translationId: null,
  books: [] as BibleBook[],
  bookId: null,
  chapter: null,
  chapterVerses: [] as BibleVerse[],
  query: '',
  mode: 'browse' as BibleMode,
  searchResults: [] as BibleVerseMatch[],
  reference: null,
  error: null,
};

export const useBibleStore = create<BibleState>((set, get) => ({
  ...VAZIO,

  refreshTranslations: async () => {
    try {
      const translations = await api.listBibleTranslations();
      set({ translations, error: null });

      // Com uma so' traducao instalada -- o caso comum no dia a dia de uma
      // igreja -- ja seleciona, poupando um clique do operador.
      const { translationId } = get();
      if (translationId === null && translations.length > 0) {
        await get().selectTranslation(translations[0]!.id);
      }
    } catch {
      // Fora do Tauri nao ha nucleo: a secao fica vazia, sem alarmar o
      // operador com um erro que ele nao pode resolver.
    }
  },

  selectTranslation: async (id) => {
    try {
      const books = await api.listBibleBooks(id);
      set({
        translationId: id,
        books,
        bookId: null,
        chapter: null,
        chapterVerses: [],
        mode: 'browse',
        reference: null,
        searchResults: [],
        error: null,
      });
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },

  selectBook: async (id) => {
    try {
      const chapterVerses = await api.getBibleChapter(id, 1);
      set({
        bookId: id,
        chapter: 1,
        chapterVerses,
        mode: 'browse',
        query: '',
        reference: null,
        searchResults: [],
        error: null,
      });
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },

  selectChapter: async (chapterNumber) => {
    const { bookId } = get();
    if (bookId === null) return;
    try {
      const chapterVerses = await api.getBibleChapter(bookId, chapterNumber);
      set({
        chapter: chapterNumber,
        chapterVerses,
        mode: 'browse',
        query: '',
        reference: null,
        searchResults: [],
        error: null,
      });
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },

  search: async (query) => {
    const searchId = ++latestSearchId;
    set({ query });

    const { translationId } = get();
    if (translationId === null) return;

    if (query.trim() === '') {
      if (searchId === latestSearchId) {
        set({ mode: 'browse', reference: null, searchResults: [], error: null });
      }
      return;
    }

    // Tenta como referencia primeiro. Uma busca por palavra comum (“amor”)
    // vai falhar aqui rapido -- a estrutura nao bate com <livro> <capitulo>
    // -- e cair para a busca por palavra abaixo.
    try {
      const reference = await api.resolveBibleReference(translationId, query);
      if (searchId !== latestSearchId) return;
      set({ mode: 'reference', reference, searchResults: [], error: null });
      return;
    } catch (cause) {
      if (searchId !== latestSearchId) return;
      log.debug('texto nao e uma referencia, tentando busca por palavra', {
        code: isAppError(cause) ? cause.code : 'UNKNOWN',
      });
    }

    try {
      const searchResults = await api.searchBible(translationId, query);
      if (searchId !== latestSearchId) return;
      set({ mode: 'search', searchResults, reference: null, error: null });
    } catch (cause) {
      if (searchId !== latestSearchId) return;
      set({ error: toAppError(cause), mode: 'search', searchResults: [] });
    }
  },

  importTranslation: async (input) => {
    try {
      await api.importBibleTranslation(input);
      set({ error: null });
      await get().refreshTranslations();
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },

  deleteTranslation: async (id) => {
    try {
      await api.deleteBibleTranslation(id);
      if (get().translationId === id) {
        set({ translationId: null, books: [], bookId: null, chapter: null, chapterVerses: [] });
      }
      set({ error: null });
      await get().refreshTranslations();
    } catch (cause) {
      set({ error: toAppError(cause) });
    }
  },
}));

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetBibleStore(): void {
  latestSearchId = 0;
  useBibleStore.setState({ ...VAZIO });
}
