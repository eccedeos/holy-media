import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song, SongSummary } from '@holy-media/types';
import { useSongsStore, resetSongsStore } from './songs-store';
import { createAppError } from '@/lib/ipc';
import * as api from '@/lib/songs-api';

vi.mock('@/lib/songs-api');

function resumo(id: string, title: string, favorite = false): SongSummary {
  return { id, title, artist: 'Artista', favorite, slideCount: 2, updatedAt: 1 };
}

function completa(id: string, title: string): Song {
  return {
    id,
    title,
    artist: 'Artista',
    author: '',
    category: '',
    favorite: false,
    tags: [],
    slides: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetSongsStore();
});

describe('busca', () => {
  it('guarda os resultados e o texto pesquisado', async () => {
    vi.mocked(api.searchSongs).mockResolvedValue([resumo('1', 'Aleluia')]);

    await useSongsStore.getState().search('alel');

    const state = useSongsStore.getState();
    expect(state.query).toBe('alel');
    expect(state.status).toBe('ready');
    expect(state.results).toHaveLength(1);
  });

  it('mostra a mensagem amigavel do nucleo quando a busca falha', async () => {
    vi.mocked(api.searchSongs).mockRejectedValue(
      createAppError('DATABASE_FAILED', 'disk I/O error'),
    );

    await useSongsStore.getState().search('alel');

    const state = useSongsStore.getState();
    expect(state.status).toBe('error');
    expect(state.error?.message).toBe('Nao foi possivel acessar a biblioteca local.');
    expect(state.results).toEqual([]);
  });

  it('descarta a resposta atrasada de uma busca antiga', async () => {
    // O operador digita "a" e depois "ab". A resposta de "a" volta por ultimo.
    let resolvePrimeira: ((value: SongSummary[]) => void) | undefined;
    vi.mocked(api.searchSongs)
      .mockImplementationOnce(
        () =>
          new Promise<SongSummary[]>((resolve) => {
            resolvePrimeira = resolve;
          }),
      )
      .mockResolvedValueOnce([resumo('2', 'Resultado de "ab"')]);

    const primeira = useSongsStore.getState().search('a');
    await useSongsStore.getState().search('ab');

    resolvePrimeira?.([resumo('1', 'Resultado velho de "a"')]);
    await primeira;

    expect(useSongsStore.getState().results).toEqual([resumo('2', 'Resultado de "ab"')]);
  });
});

describe('favoritar', () => {
  it('atualiza a linha no lugar, sem refazer a busca', async () => {
    vi.mocked(api.searchSongs).mockResolvedValue([resumo('1', 'Aleluia')]);
    await useSongsStore.getState().search('');
    vi.mocked(api.toggleSongFavorite).mockResolvedValue(true);

    await useSongsStore.getState().toggleFavorite('1');

    expect(useSongsStore.getState().results[0]?.favorite).toBe(true);
    // Refazer a busca reordenaria a lista debaixo do dedo do operador.
    expect(api.searchSongs).toHaveBeenCalledTimes(1);
  });
});

describe('excluir', () => {
  it('fecha o detalhe quando a musica excluida era a aberta', async () => {
    vi.mocked(api.getSong).mockResolvedValue(completa('1', 'Aleluia'));
    vi.mocked(api.deleteSong).mockResolvedValue(undefined);
    vi.mocked(api.searchSongs).mockResolvedValue([]);
    await useSongsStore.getState().select('1');

    await useSongsStore.getState().remove('1');

    expect(useSongsStore.getState().selected).toBeNull();
  });

  it('mantem o detalhe aberto ao excluir outra musica', async () => {
    vi.mocked(api.getSong).mockResolvedValue(completa('1', 'Aleluia'));
    vi.mocked(api.deleteSong).mockResolvedValue(undefined);
    vi.mocked(api.searchSongs).mockResolvedValue([]);
    await useSongsStore.getState().select('1');

    await useSongsStore.getState().remove('2');

    expect(useSongsStore.getState().selected?.id).toBe('1');
  });

  it('guarda o erro do nucleo quando a musica ja nao existe', async () => {
    vi.mocked(api.deleteSong).mockRejectedValue(
      createAppError('NOT_FOUND', undefined, 'Musica nao encontrada.'),
    );

    await useSongsStore.getState().remove('sumida');

    expect(useSongsStore.getState().error?.message).toBe('Musica nao encontrada.');
  });
});

describe('criar e editar', () => {
  it('abre a musica criada e atualiza a lista', async () => {
    const criada = completa('1', 'Nova');
    vi.mocked(api.createSong).mockResolvedValue(criada);
    vi.mocked(api.searchSongs).mockResolvedValue([resumo('1', 'Nova')]);

    const devolvida = await useSongsStore.getState().create({
      title: 'Nova',
      artist: '',
      author: '',
      category: '',
      favorite: false,
      tags: [],
      slides: [],
    });

    expect(devolvida).toEqual(criada);
    expect(useSongsStore.getState().selected).toEqual(criada);
    expect(api.searchSongs).toHaveBeenCalled();
  });

  it('devolve null e guarda o erro quando o nucleo recusa a entrada', async () => {
    vi.mocked(api.createSong).mockRejectedValue(
      createAppError('INVALID_INPUT', undefined, 'A musica precisa de um titulo.'),
    );

    const devolvida = await useSongsStore.getState().create({
      title: '',
      artist: '',
      author: '',
      category: '',
      favorite: false,
      tags: [],
      slides: [],
    });

    expect(devolvida).toBeNull();
    expect(useSongsStore.getState().error?.message).toBe('A musica precisa de um titulo.');
  });
});
