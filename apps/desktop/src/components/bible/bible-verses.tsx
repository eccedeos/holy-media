import { Play } from 'lucide-react';
import { useBibleStore } from '@/store/bible-store';
import { usePresentationStore } from '@/store/presentation-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BibleVerse } from '@holy-media/types';

/**
 * Coluna central da Biblia: mostra o capitulo navegado, o resultado de
 * busca por palavra, ou a previa de uma referencia resolvida -- e' o que
 * `mode` da store decide.
 *
 * Cada versiculo e' clicavel e apresenta **so' aquele versiculo**. Para
 * apresentar uma faixa inteira ("João 3:16-18") ou um capitulo completo, ha'
 * um botao "Apresentar" que reenvia o texto original digitado (ou uma
 * referencia de capitulo inteiro montada a partir do livro/capitulo
 * navegado) para o mesmo comando -- e' o nucleo que resolve a faixa de novo,
 * nunca a interface que monta os versiculos a apresentar.
 */
export function BibleVerses() {
  const translationId = useBibleStore((state) => state.translationId);
  const mode = useBibleStore((state) => state.mode);
  const bookId = useBibleStore((state) => state.bookId);
  const chapter = useBibleStore((state) => state.chapter);
  const chapterVerses = useBibleStore((state) => state.chapterVerses);
  const books = useBibleStore((state) => state.books);
  const query = useBibleStore((state) => state.query);
  const searchResults = useBibleStore((state) => state.searchResults);
  const reference = useBibleStore((state) => state.reference);

  const presentBible = usePresentationStore((state) => state.presentBible);
  const live = usePresentationStore((state) => state.state);

  const selectedBook = books.find((book) => book.id === bookId) ?? null;

  if (translationId === null) {
    return (
      <section
        aria-label="Versiculos"
        className="flex h-full items-center justify-center p-8 text-center"
      >
        <p className="text-sm text-content-muted">
          Importe uma traducao na coluna da esquerda para comecar.
        </p>
      </section>
    );
  }

  /** So' o que a linha de um versiculo precisa saber do livro. Um `BibleBook`
   * completo seria pedir demais dos resultados de busca, que so' carregam
   * nome e sigla -- nao a lista de capitulos nem a posicao canonica. */
  interface BookRef {
    id: string;
    abbreviation: string;
  }

  /** `true` quando este versiculo especifico e' o que esta no ar agora. */
  const isLive = (book: BookRef, chapterNumber: number, verse: BibleVerse) =>
    live.sourceId?.startsWith(`bible:${book.id}:${chapterNumber}:`) === true &&
    live.label === `${book.abbreviation} ${chapterNumber}:${verse.verse}`;

  const verseRow = (book: BookRef, chapterNumber: number, verse: BibleVerse, prefix?: string) => {
    const noAr = isLive(book, chapterNumber, verse);
    return (
      <li key={verse.id}>
        <button
          type="button"
          onClick={() =>
            void presentBible(translationId, `${book.abbreviation} ${chapterNumber}:${verse.verse}`)
          }
          aria-current={noAr ? 'true' : undefined}
          className={cn(
            'w-full rounded-md border px-3 py-2 text-left text-sm',
            noAr ? 'border-accent bg-surface-raised' : 'border-line hover:bg-surface-raised',
          )}
        >
          <span className="mr-2 text-xs text-content-muted">{prefix ?? verse.verse}</span>
          {verse.text}
        </button>
      </li>
    );
  };

  if (mode === 'search') {
    return (
      <section aria-label="Resultado da busca" className="flex h-full min-h-0 flex-col">
        <header className="border-b border-line p-4">
          <h2 className="text-sm font-medium text-content-muted">
            {searchResults.length} resultado(s) para &quot;{query}&quot;
          </h2>
        </header>
        <ol className="min-h-0 flex-1 overflow-y-auto p-4">
          {searchResults.length === 0 ? (
            <p className="text-sm text-content-muted">Nenhum versiculo encontrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {searchResults.map((match) =>
                verseRow(
                  { id: match.verse.bookId, abbreviation: match.bookAbbreviation },
                  match.verse.chapter,
                  match.verse,
                  `${match.bookAbbreviation} ${match.verse.chapter}:${match.verse.verse}`,
                ),
              )}
            </div>
          )}
        </ol>
      </section>
    );
  }

  if (mode === 'reference' && reference !== null) {
    const primeiro = reference.verses[0];
    const ultimo = reference.verses[reference.verses.length - 1];
    const faixa =
      primeiro !== undefined && ultimo !== undefined && primeiro.verse !== ultimo.verse
        ? `${primeiro.verse}-${ultimo.verse}`
        : String(primeiro?.verse ?? '');

    return (
      <section aria-label="Referencia" className="flex h-full min-h-0 flex-col">
        <header className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-lg font-semibold">
            {reference.book.name} {reference.chapter}:{faixa}
          </h2>
          <Button size="sm" onClick={() => void presentBible(translationId, query)}>
            <Play className="size-4" aria-hidden />
            Apresentar
          </Button>
        </header>
        <ol className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            {reference.verses.map((verse) => verseRow(reference.book, reference.chapter, verse))}
          </div>
        </ol>
      </section>
    );
  }

  // mode === 'browse'
  if (selectedBook === null || chapter === null) {
    return (
      <section
        aria-label="Versiculos"
        className="flex h-full items-center justify-center p-8 text-center"
      >
        <p className="text-sm text-content-muted">Selecione um livro na coluna da esquerda.</p>
      </section>
    );
  }

  return (
    <section aria-label="Capitulo" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-line p-4">
        <h2 className="text-lg font-semibold">
          {selectedBook.name} {chapter}
        </h2>
        <Button
          size="sm"
          onClick={() =>
            void presentBible(translationId, `${selectedBook.abbreviation} ${chapter}`)
          }
        >
          <Play className="size-4" aria-hidden />
          Apresentar capitulo
        </Button>
      </header>
      <ol className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {chapterVerses.map((verse) => verseRow(selectedBook, chapter, verse))}
        </div>
      </ol>
    </section>
  );
}
