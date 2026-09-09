import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BibleBook, BibleReferenceResult, BibleVerseMatch } from '@holy-media/types';
import { BibleVerses } from './bible-verses';
import { resetBibleStore, useBibleStore } from '@/store/bible-store';
import { resetPresentationStore, usePresentationStore } from '@/store/presentation-store';
import * as presentationApi from '@/lib/presentation-api';

vi.mock('@/lib/presentation-api');

const LIVRO: BibleBook = {
  id: 'l1',
  translationId: 't1',
  position: 0,
  name: 'Joao',
  abbreviation: 'Jo',
  chapterCount: 21,
};

beforeEach(() => {
  vi.resetAllMocks();
  resetBibleStore();
  resetPresentationStore();
});

describe('sem traducao', () => {
  it('convida a importar', () => {
    render(<BibleVerses />);
    expect(screen.getByText(/Importe uma traducao/)).toBeInTheDocument();
  });
});

describe('modo navegacao', () => {
  it('mostra os versiculos do capitulo e apresenta um ao clicar', async () => {
    const user = userEvent.setup();
    useBibleStore.setState({
      translationId: 't1',
      mode: 'browse',
      books: [LIVRO],
      bookId: 'l1',
      chapter: 3,
      chapterVerses: [
        { id: 'v1', bookId: 'l1', chapter: 3, verse: 16, text: 'Texto de exemplo 3:16' },
      ],
    });
    vi.mocked(presentationApi.presentBibleReference).mockResolvedValue({
      output: { kind: 'idle' },
      sourceId: null,
      title: '',
      label: '',
      index: 0,
      total: 0,
      blackedOut: false,
      canGoNext: false,
      canGoPrevious: false,
    });

    render(<BibleVerses />);
    await user.click(screen.getByRole('button', { name: /Texto de exemplo 3:16/ }));

    await waitFor(() =>
      expect(presentationApi.presentBibleReference).toHaveBeenCalledWith('t1', 'Jo 3:16'),
    );
  });

  it('apresentar capitulo reenvia o livro e capitulo, nao os versiculos', async () => {
    const user = userEvent.setup();
    useBibleStore.setState({
      translationId: 't1',
      mode: 'browse',
      books: [LIVRO],
      bookId: 'l1',
      chapter: 3,
      chapterVerses: [
        { id: 'v1', bookId: 'l1', chapter: 3, verse: 16, text: 'Texto de exemplo 3:16' },
      ],
    });
    vi.mocked(presentationApi.presentBibleReference).mockResolvedValue({
      output: { kind: 'idle' },
      sourceId: null,
      title: '',
      label: '',
      index: 0,
      total: 0,
      blackedOut: false,
      canGoNext: false,
      canGoPrevious: false,
    });

    render(<BibleVerses />);
    await user.click(screen.getByRole('button', { name: 'Apresentar capitulo' }));

    await waitFor(() =>
      expect(presentationApi.presentBibleReference).toHaveBeenCalledWith('t1', 'Jo 3'),
    );
  });

  it('destaca o versiculo que esta no ar', () => {
    useBibleStore.setState({
      translationId: 't1',
      mode: 'browse',
      books: [LIVRO],
      bookId: 'l1',
      chapter: 3,
      chapterVerses: [
        { id: 'v1', bookId: 'l1', chapter: 3, verse: 16, text: 'Texto de exemplo 3:16' },
        { id: 'v2', bookId: 'l1', chapter: 3, verse: 17, text: 'Texto de exemplo 3:17' },
      ],
    });
    usePresentationStore.setState({
      state: {
        output: { kind: 'slide', content: 'x' },
        sourceId: 'bible:l1:3:16',
        title: 'Joao 3',
        label: 'Jo 3:16',
        index: 0,
        total: 1,
        blackedOut: false,
        canGoNext: false,
        canGoPrevious: false,
      },
    });

    render(<BibleVerses />);

    expect(screen.getByRole('button', { name: /Texto de exemplo 3:16/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: /Texto de exemplo 3:17/ })).not.toHaveAttribute(
      'aria-current',
    );
  });
});

describe('modo referencia', () => {
  function referencia(): BibleReferenceResult {
    return {
      book: LIVRO,
      chapter: 3,
      verses: [
        { id: 'v1', bookId: 'l1', chapter: 3, verse: 16, text: 'Texto de exemplo 3:16' },
        { id: 'v2', bookId: 'l1', chapter: 3, verse: 17, text: 'Texto de exemplo 3:17' },
      ],
    };
  }

  it('mostra a faixa de versiculos no titulo', () => {
    useBibleStore.setState({
      translationId: 't1',
      mode: 'reference',
      query: 'Jo 3:16-17',
      reference: referencia(),
    });

    render(<BibleVerses />);

    expect(screen.getByRole('heading')).toHaveTextContent('Joao 3:16-17');
  });

  it('apresentar reenvia exatamente o texto que o operador digitou', async () => {
    const user = userEvent.setup();
    useBibleStore.setState({
      translationId: 't1',
      mode: 'reference',
      query: 'Jo 3:16-17',
      reference: referencia(),
    });
    vi.mocked(presentationApi.presentBibleReference).mockResolvedValue({
      output: { kind: 'idle' },
      sourceId: null,
      title: '',
      label: '',
      index: 0,
      total: 0,
      blackedOut: false,
      canGoNext: false,
      canGoPrevious: false,
    });

    render(<BibleVerses />);
    await user.click(screen.getByRole('button', { name: 'Apresentar' }));

    await waitFor(() =>
      expect(presentationApi.presentBibleReference).toHaveBeenCalledWith('t1', 'Jo 3:16-17'),
    );
  });
});

describe('modo busca', () => {
  it('mostra a contagem e o resultado com a localizacao', () => {
    const resultado: BibleVerseMatch = {
      verse: { id: 'v1', bookId: 'l1', chapter: 3, verse: 16, text: 'Texto de exemplo com amor' },
      bookName: 'Joao',
      bookAbbreviation: 'Jo',
    };
    useBibleStore.setState({
      translationId: 't1',
      mode: 'search',
      query: 'amor',
      searchResults: [resultado],
    });

    render(<BibleVerses />);

    expect(screen.getByText('1 resultado(s) para "amor"')).toBeInTheDocument();
    expect(screen.getByText('Jo 3:16')).toBeInTheDocument();
  });

  it('mostra mensagem propria quando nao ha resultado', () => {
    useBibleStore.setState({
      translationId: 't1',
      mode: 'search',
      query: 'zzz',
      searchResults: [],
    });

    render(<BibleVerses />);

    expect(screen.getByText('Nenhum versiculo encontrado.')).toBeInTheDocument();
  });
});
