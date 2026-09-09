import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BibleBook,
  BibleReferenceResult,
  BibleTranslation,
  BibleVerseMatch,
} from '@holy-media/types';
import { resetBibleStore, useBibleStore } from './bible-store';
import { createAppError } from '@/lib/ipc';
import * as api from '@/lib/bible-api';

vi.mock('@/lib/bible-api');

function traducao(id: string, abbreviation: string): BibleTranslation {
  return { id, abbreviation, name: `Traducao ${abbreviation}`, language: 'pt-BR', importedAt: 1 };
}

function livro(id: string, name: string, position = 0): BibleBook {
  return {
    id,
    translationId: 't1',
    position,
    name,
    abbreviation: name.slice(0, 2),
    chapterCount: 3,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetBibleStore();
});

describe('traducoes', () => {
  it('carrega a lista de traducoes', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([]);

    await useBibleStore.getState().refreshTranslations();

    expect(useBibleStore.getState().translations).toHaveLength(1);
  });

  it('seleciona automaticamente quando so ha uma traducao', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([livro('l1', 'Livro Um')]);

    await useBibleStore.getState().refreshTranslations();

    expect(useBibleStore.getState().translationId).toBe('t1');
    expect(useBibleStore.getState().books).toHaveLength(1);
  });

  it('nao alarma o operador quando roda fora do Tauri', async () => {
    vi.mocked(api.listBibleTranslations).mockRejectedValue(
      createAppError('IPC_UNAVAILABLE', 'fora do Tauri'),
    );

    await useBibleStore.getState().refreshTranslations();

    expect(useBibleStore.getState().error).toBeNull();
    expect(useBibleStore.getState().translations).toEqual([]);
  });
});

describe('navegacao', () => {
  it('selecionar um livro carrega o capitulo 1', async () => {
    vi.mocked(api.getBibleChapter).mockResolvedValue([
      { id: 'v1', bookId: 'l1', chapter: 1, verse: 1, text: 'Texto de exemplo' },
    ]);

    await useBibleStore.getState().selectBook('l1');

    expect(api.getBibleChapter).toHaveBeenCalledWith('l1', 1);
    expect(useBibleStore.getState().chapter).toBe(1);
    expect(useBibleStore.getState().mode).toBe('browse');
  });

  it('selecionar capitulo busca os versiculos daquele capitulo', async () => {
    useBibleStore.setState({ bookId: 'l1' });
    vi.mocked(api.getBibleChapter).mockResolvedValue([]);

    await useBibleStore.getState().selectChapter(3);

    expect(api.getBibleChapter).toHaveBeenCalledWith('l1', 3);
    expect(useBibleStore.getState().chapter).toBe(3);
  });

  it('selecionar capitulo sem livro escolhido nao faz nada', async () => {
    await useBibleStore.getState().selectChapter(2);
    expect(api.getBibleChapter).not.toHaveBeenCalled();
  });
});

describe('busca unica: referencia com fallback para palavra', () => {
  beforeEach(() => {
    useBibleStore.setState({ translationId: 't1' });
  });

  function referencia(): BibleReferenceResult {
    return {
      book: {
        id: 'l1',
        translationId: 't1',
        position: 0,
        name: 'Joao',
        abbreviation: 'Jo',
        chapterCount: 21,
      },
      chapter: 3,
      verses: [{ id: 'v1', bookId: 'l1', chapter: 3, verse: 16, text: 'Texto de exemplo 3:16' }],
    };
  }

  it('texto que resolve como referencia vai para o modo referencia', async () => {
    vi.mocked(api.resolveBibleReference).mockResolvedValue(referencia());

    await useBibleStore.getState().search('Joao 3:16');

    expect(useBibleStore.getState().mode).toBe('reference');
    expect(useBibleStore.getState().reference).toEqual(referencia());
    expect(api.searchBible).not.toHaveBeenCalled();
  });

  it('texto que nao e referencia cai para busca por palavra', async () => {
    vi.mocked(api.resolveBibleReference).mockRejectedValue(
      createAppError('INVALID_INPUT', 'nao e referencia'),
    );
    const resultados: BibleVerseMatch[] = [
      {
        verse: { id: 'v1', bookId: 'l1', chapter: 1, verse: 1, text: 'Texto de exemplo com amor' },
        bookName: 'Livro Um',
        bookAbbreviation: 'Lv1',
      },
    ];
    vi.mocked(api.searchBible).mockResolvedValue(resultados);

    await useBibleStore.getState().search('amor');

    expect(useBibleStore.getState().mode).toBe('search');
    expect(useBibleStore.getState().searchResults).toEqual(resultados);
  });

  it('texto vazio volta para o modo de navegacao', async () => {
    useBibleStore.setState({ mode: 'search', searchResults: [{} as BibleVerseMatch] });

    await useBibleStore.getState().search('   ');

    expect(useBibleStore.getState().mode).toBe('browse');
    expect(useBibleStore.getState().searchResults).toEqual([]);
  });

  it('descarta a resposta atrasada de uma busca antiga', async () => {
    let resolvePrimeira: ((value: never) => void) | undefined;
    vi.mocked(api.resolveBibleReference)
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            resolvePrimeira = reject as (value: never) => void;
          }),
      )
      .mockRejectedValueOnce(createAppError('INVALID_INPUT', 'nao e referencia'));
    vi.mocked(api.searchBible).mockResolvedValue([]);

    const primeira = useBibleStore.getState().search('a');
    await useBibleStore.getState().search('amor');

    resolvePrimeira?.(createAppError('INVALID_INPUT', 'velha') as never);
    await primeira;

    // A segunda busca ("amor") e' a que deveria ter vencido.
    expect(useBibleStore.getState().query).toBe('amor');
  });
});

describe('importar e excluir', () => {
  it('importa e atualiza a lista de traducoes', async () => {
    vi.mocked(api.importBibleTranslation).mockResolvedValue(traducao('t1', 'TST'));
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([]);

    await useBibleStore
      .getState()
      .importTranslation({ abbreviation: 'TST', name: 'Teste', language: 'pt-BR', books: [] });

    expect(api.importBibleTranslation).toHaveBeenCalled();
    expect(useBibleStore.getState().translations).toHaveLength(1);
  });

  it('guarda o erro do nucleo ao importar um arquivo invalido', async () => {
    vi.mocked(api.importBibleTranslation).mockRejectedValue(
      createAppError('INVALID_INPUT', undefined, 'A traducao precisa de um nome.'),
    );

    await useBibleStore
      .getState()
      .importTranslation({ abbreviation: 'TST', name: '', language: 'pt-BR', books: [] });

    expect(useBibleStore.getState().error?.message).toBe('A traducao precisa de um nome.');
  });

  it('limpa a selecao ao excluir a traducao ativa', async () => {
    useBibleStore.setState({ translationId: 't1', books: [livro('l1', 'Livro')] });
    vi.mocked(api.deleteBibleTranslation).mockResolvedValue(undefined);
    vi.mocked(api.listBibleTranslations).mockResolvedValue([]);

    await useBibleStore.getState().deleteTranslation('t1');

    expect(useBibleStore.getState().translationId).toBeNull();
    expect(useBibleStore.getState().books).toEqual([]);
  });
});
