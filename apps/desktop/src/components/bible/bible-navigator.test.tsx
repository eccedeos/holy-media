import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BibleBook, BibleTranslation } from '@holy-media/types';
import { BibleNavigator } from './bible-navigator';
import { resetBibleStore } from '@/store/bible-store';
import * as api from '@/lib/bible-api';

vi.mock('@/lib/bible-api');

function traducao(id: string, abbreviation: string): BibleTranslation {
  return { id, abbreviation, name: `Traducao ${abbreviation}`, language: 'pt-BR', importedAt: 1 };
}

function livro(id: string, name: string, chapterCount = 3): BibleBook {
  return {
    id,
    translationId: 't1',
    position: 0,
    name,
    abbreviation: name.slice(0, 2),
    chapterCount,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetBibleStore();
  vi.mocked(api.listBibleTranslations).mockResolvedValue([]);
});

describe('sem traducao importada', () => {
  it('explica que e preciso importar', async () => {
    render(<BibleNavigator />);

    expect(await screen.findByText('Nenhuma traducao importada.')).toBeInTheDocument();
  });
});

describe('com traducao', () => {
  it('lista os livros da traducao selecionada', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([livro('l1', 'Genesis')]);

    render(<BibleNavigator />);

    expect(await screen.findByRole('button', { name: 'Genesis' })).toBeInTheDocument();
  });

  it('mostra o seletor de capitulo so depois de escolher um livro', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([livro('l1', 'Genesis', 50)]);
    vi.mocked(api.getBibleChapter).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<BibleNavigator />);
    expect(screen.queryByLabelText('Capitulo')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Genesis' }));

    const seletor = await screen.findByLabelText('Capitulo');
    expect(seletor).toBeInTheDocument();
    // 50 capitulos em Genesis: confere que a lista foi montada por inteiro,
    // nao truncada.
    expect(screen.getAllByRole('option')).toHaveLength(50);
  });

  it('nao mostra o seletor de traducao quando ha so uma', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([]);

    render(<BibleNavigator />);
    await screen.findByText(/Nenhuma traducao/);

    expect(screen.queryByLabelText('Traducao')).not.toBeInTheDocument();
  });

  it('mostra o seletor quando ha mais de uma traducao', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([
      traducao('t1', 'TST'),
      traducao('t2', 'OUT'),
    ]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([]);

    render(<BibleNavigator />);

    expect(await screen.findByLabelText('Traducao')).toBeInTheDocument();
  });
});

describe('busca', () => {
  it('so dispara a busca apos o debounce, uma vez por palavra digitada', async () => {
    vi.mocked(api.listBibleTranslations).mockResolvedValue([traducao('t1', 'TST')]);
    vi.mocked(api.listBibleBooks).mockResolvedValue([]);
    vi.mocked(api.resolveBibleReference).mockRejectedValue({
      code: 'INVALID_INPUT',
      message: 'nao e referencia',
    });
    vi.mocked(api.searchBible).mockResolvedValue([]);
    const user = userEvent.setup();

    render(<BibleNavigator />);
    await screen.findByText(/Nenhuma traducao/);

    await user.type(screen.getByLabelText('Buscar na Biblia'), 'amor');

    await waitFor(() => expect(api.resolveBibleReference).toHaveBeenCalledWith('t1', 'amor'));
    const chamadas = vi.mocked(api.resolveBibleReference).mock.calls.map(([, texto]) => texto);
    for (const prefixo of ['a', 'am', 'amo']) {
      expect(chamadas).not.toContain(prefixo);
    }
  });

  it('a caixa de busca fica desabilitada sem traducao selecionada', () => {
    render(<BibleNavigator />);
    expect(screen.getByLabelText('Buscar na Biblia')).toBeDisabled();
  });
});

describe('importacao', () => {
  it('importa o conteudo de um arquivo JSON selecionado', async () => {
    vi.mocked(api.importBibleTranslation).mockResolvedValue(traducao('t1', 'TST'));
    const user = userEvent.setup();

    render(<BibleNavigator />);

    const conteudo = JSON.stringify({
      abbreviation: 'TST',
      name: 'Traducao de Teste',
      language: 'pt-BR',
      books: [{ name: 'Livro Um', abbreviation: 'Lv1', chapters: [['Texto de exemplo']] }],
    });
    const arquivo = new File([conteudo], 'traducao.json', { type: 'application/json' });

    await user.upload(screen.getByLabelText('Importar arquivo de traducao'), arquivo);

    await waitFor(() =>
      expect(api.importBibleTranslation).toHaveBeenCalledWith(
        expect.objectContaining({ abbreviation: 'TST' }),
      ),
    );
  });

  it('mostra erro claro para um arquivo que nao e JSON valido', async () => {
    const user = userEvent.setup();
    render(<BibleNavigator />);

    const arquivo = new File(['isto nao e json {{{'], 'traducao.json', {
      type: 'application/json',
    });
    await user.upload(screen.getByLabelText('Importar arquivo de traducao'), arquivo);

    expect(await screen.findByRole('alert')).toHaveTextContent('nao e um JSON valido');
    expect(api.importBibleTranslation).not.toHaveBeenCalled();
  });
});
