import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SongSummary } from '@holy-media/types';
import { SongLibrary } from './song-library';
import { resetSongsStore, useSongsStore } from '@/store/songs-store';
import * as api from '@/lib/songs-api';

vi.mock('@/lib/songs-api');

function resumo(id: string, title: string, favorite = false): SongSummary {
  return { id, title, artist: 'Adhemar de Campos', favorite, slideCount: 2, updatedAt: 1 };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetSongsStore();
});

describe('SongLibrary', () => {
  it('lista a biblioteca ao abrir, sem o operador digitar nada', async () => {
    vi.mocked(api.searchSongs).mockResolvedValue([resumo('1', 'Grande e o Senhor')]);

    render(<SongLibrary />);

    expect(await screen.findByText('Grande e o Senhor')).toBeInTheDocument();
    expect(api.searchSongs).toHaveBeenCalledWith('');
  });

  it('nao dispara uma consulta por tecla enquanto o operador digita', async () => {
    // O debounce em si e' verificado em `use-debounced-value.test.ts`. Aqui o
    // que importa e' a consequencia: os prefixos intermediarios nunca chegam
    // ao nucleo -- so' o texto final chega.
    const user = userEvent.setup();
    vi.mocked(api.searchSongs).mockResolvedValue([]);

    render(<SongLibrary />);
    await user.type(screen.getByRole('searchbox', { name: /buscar musicas/i }), 'aleluia');

    await waitFor(() => expect(api.searchSongs).toHaveBeenCalledWith('aleluia'));

    const consultados = vi.mocked(api.searchSongs).mock.calls.map(([texto]) => texto);
    for (const prefixo of ['a', 'al', 'ale', 'alel', 'alelu', 'alelui']) {
      expect(consultados).not.toContain(prefixo);
    }
  });

  it('mantem o texto digitado imediatamente, sem esperar a consulta', async () => {
    const user = userEvent.setup();
    vi.mocked(api.searchSongs).mockResolvedValue([]);

    render(<SongLibrary />);
    const campo = screen.getByRole('searchbox', { name: /buscar musicas/i });
    await user.type(campo, 'alel');

    // Digitar nunca pode engasgar, mesmo com a busca ainda em voo.
    expect(campo).toHaveValue('alel');
  });

  it('mostra mensagem propria quando nao ha resultado', async () => {
    vi.mocked(api.searchSongs).mockResolvedValue([]);

    render(<SongLibrary />);

    expect(await screen.findByText('Nenhuma musica encontrada.')).toBeInTheDocument();
  });

  it('mostra a mensagem amigavel do nucleo em caso de erro', async () => {
    vi.mocked(api.searchSongs).mockRejectedValue({
      code: 'DATABASE_FAILED',
      message: 'Nao foi possivel acessar a biblioteca local.',
      detail: 'disk I/O error',
    });

    render(<SongLibrary />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Nao foi possivel acessar a biblioteca local.');
    expect(alerta).not.toHaveTextContent('disk I/O error');
  });

  it('abre a musica ao clicar na linha', async () => {
    const user = userEvent.setup();
    vi.mocked(api.searchSongs).mockResolvedValue([resumo('1', 'Grande e o Senhor')]);
    vi.mocked(api.getSong).mockResolvedValue({
      id: '1',
      title: 'Grande e o Senhor',
      artist: 'Adhemar de Campos',
      author: '',
      category: '',
      favorite: false,
      tags: [],
      slides: [],
      createdAt: 1,
      updatedAt: 1,
    });

    render(<SongLibrary />);
    await user.click(await screen.findByRole('button', { name: /^Grande e o Senhor/ }));

    await waitFor(() => expect(useSongsStore.getState().selected?.id).toBe('1'));
  });

  it('favoritar nao abre a musica', async () => {
    const user = userEvent.setup();
    vi.mocked(api.searchSongs).mockResolvedValue([resumo('1', 'Grande e o Senhor')]);
    vi.mocked(api.toggleSongFavorite).mockResolvedValue(true);

    render(<SongLibrary />);
    await user.click(await screen.findByRole('button', { name: /^Favoritar/ }));

    await waitFor(() => expect(api.toggleSongFavorite).toHaveBeenCalledWith('1'));
    expect(api.getSong).not.toHaveBeenCalled();
  });
});
