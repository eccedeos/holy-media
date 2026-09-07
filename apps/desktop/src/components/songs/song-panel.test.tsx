import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Song } from '@holy-media/types';
import { SongPanel } from './song-panel';
import { resetSongsStore, useSongsStore } from '@/store/songs-store';
import * as api from '@/lib/songs-api';

vi.mock('@/lib/songs-api');

function completa(id: string, title: string, overrides: Partial<Song> = {}): Song {
  return {
    id,
    title,
    artist: 'Artista',
    author: '',
    category: '',
    favorite: false,
    tags: ['natal'],
    slides: [
      { id: 's1', position: 0, label: 'Verso 1', content: 'Primeira estrofe' },
      { id: 's2', position: 1, label: 'Refrao', content: 'Segunda estrofe' },
    ],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetSongsStore();
  vi.mocked(api.searchSongs).mockResolvedValue([]);
});

describe('cadastro', () => {
  it('envia titulo, tags e slides divididos pela linha em branco', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSong).mockResolvedValue(completa('1', 'Nova'));
    useSongsStore.getState().startCreate();

    render(<SongPanel />);
    await user.type(screen.getByLabelText('Titulo'), 'Nova');
    await user.type(screen.getByLabelText(/Tags/), 'natal, ceia');
    // `[[` escapa o colchete literal: para o user-event, `[` inicia um
    // descritor de tecla.
    await user.type(
      screen.getByLabelText('Letra'),
      '[[Verso 1]{enter}Primeira estrofe{enter}{enter}[[Refrao]{enter}Aleluia',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.createSong).toHaveBeenCalled());
    expect(api.createSong).toHaveBeenCalledWith({
      title: 'Nova',
      artist: '',
      author: '',
      category: '',
      favorite: false,
      tags: ['natal', 'ceia'],
      slides: [
        { label: 'Verso 1', content: 'Primeira estrofe' },
        { label: 'Refrao', content: 'Aleluia' },
      ],
    });
  });

  it('conta os slides enquanto o operador digita', async () => {
    const user = userEvent.setup();
    useSongsStore.getState().startCreate();

    render(<SongPanel />);
    expect(screen.getByText('0 slides')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Letra'), 'Primeira{enter}{enter}Segunda');

    expect(screen.getByText('2 slides')).toBeInTheDocument();
  });

  it('mostra a recusa do nucleo sem sair do formulario', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createSong).mockRejectedValue({
      code: 'INVALID_INPUT',
      message: 'A musica precisa de um titulo.',
    });
    useSongsStore.getState().startCreate();

    render(<SongPanel />);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A musica precisa de um titulo.');
    // O que foi digitado nao pode se perder junto com o erro.
    expect(screen.getByLabelText('Letra')).toBeInTheDocument();
  });

  it('volta para a visualizacao ao cancelar', async () => {
    const user = userEvent.setup();
    useSongsStore.getState().startCreate();

    render(<SongPanel />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(useSongsStore.getState().mode).toBe('view');
  });
});

describe('edicao', () => {
  it('abre o formulario com a letra ja no formato do editor', () => {
    useSongsStore.setState({ selected: completa('1', 'Grande e o Senhor'), mode: 'edit' });

    render(<SongPanel />);

    expect(screen.getByLabelText('Titulo')).toHaveValue('Grande e o Senhor');
    expect(screen.getByLabelText(/Tags/)).toHaveValue('natal');
    expect(screen.getByLabelText('Letra')).toHaveValue(
      '[Verso 1]\nPrimeira estrofe\n\n[Refrao]\nSegunda estrofe',
    );
  });

  it('salva mantendo o id da musica editada', async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateSong).mockResolvedValue(completa('1', 'Titulo Novo'));
    useSongsStore.setState({ selected: completa('1', 'Titulo Antigo'), mode: 'edit' });

    render(<SongPanel />);
    await user.clear(screen.getByLabelText('Titulo'));
    await user.type(screen.getByLabelText('Titulo'), 'Titulo Novo');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(api.updateSong).toHaveBeenCalled());
    expect(vi.mocked(api.updateSong).mock.calls[0]?.[0]).toBe('1');
    expect(vi.mocked(api.updateSong).mock.calls[0]?.[1].title).toBe('Titulo Novo');
  });

  it('nao mantem o texto da musica anterior ao editar outra', () => {
    useSongsStore.setState({ selected: completa('1', 'Primeira'), mode: 'edit' });
    const { rerender } = render(<SongPanel />);
    expect(screen.getByLabelText('Titulo')).toHaveValue('Primeira');

    useSongsStore.setState({ selected: completa('2', 'Segunda'), mode: 'edit' });
    rerender(<SongPanel />);

    // Sem o `key` por musica, o formulario reaproveitaria o estado e salvaria
    // a letra da primeira musica no registro da segunda.
    expect(screen.getByLabelText('Titulo')).toHaveValue('Segunda');
  });
});

describe('exclusao', () => {
  it('exige confirmacao antes de excluir', async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteSong).mockResolvedValue(undefined);
    useSongsStore.setState({ selected: completa('1', 'Grande e o Senhor'), mode: 'view' });

    render(<SongPanel />);
    await user.click(screen.getByRole('button', { name: /^Excluir/ }));

    expect(api.deleteSong).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar exclusao' }));
    await waitFor(() => expect(api.deleteSong).toHaveBeenCalledWith('1'));
  });

  it('cancelar a confirmacao nao exclui', async () => {
    const user = userEvent.setup();
    useSongsStore.setState({ selected: completa('1', 'Grande e o Senhor'), mode: 'view' });

    render(<SongPanel />);
    await user.click(screen.getByRole('button', { name: /^Excluir/ }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(api.deleteSong).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Excluir/ })).toBeInTheDocument();
  });
});
