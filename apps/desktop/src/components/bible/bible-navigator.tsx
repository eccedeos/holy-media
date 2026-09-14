import { useEffect, useRef, useState } from 'react';
import { Search, Upload } from 'lucide-react';
import { useBibleStore } from '@/store/bible-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import {
  fromLegacyFormat,
  parseImportFile,
  type LegacyBibleBook,
  type TranslationMeta,
} from '@/lib/bible-import';

const log = createLogger('bible-import');

const fieldClass =
  'w-full rounded-md border border-line bg-surface-sunken ' +
  'px-2 py-1 text-xs outline-none placeholder:text-content-muted ' +
  'focus-visible:ring-2 focus-visible:ring-accent';

/**
 * Coluna de navegacao da Biblia: escolha de traducao, importacao, lista de
 * livros e a caixa unica de busca (palavra ou referencia).
 *
 * Este projeto nao distribui nenhuma traducao com o instalador -- ver
 * `docs/bible.md`. A unica forma de ter texto biblico aqui e' importar um
 * arquivo `.json`, em qualquer um dos dois formatos que `lib/bible-import.ts`
 * reconhece: o nativo (documentado em `docs/bible.md`) ou o formato "legado"
 * usado por varios repositorios publicos de Biblia em JSON -- nesse segundo
 * caso, um formulario pede sigla/nome/idioma antes de concluir a importacao.
 */
export function BibleNavigator() {
  const translations = useBibleStore((state) => state.translations);
  const translationId = useBibleStore((state) => state.translationId);
  const books = useBibleStore((state) => state.books);
  const bookId = useBibleStore((state) => state.bookId);
  const chapter = useBibleStore((state) => state.chapter);
  const error = useBibleStore((state) => state.error);
  const refresh = useBibleStore((state) => state.refreshTranslations);
  const selectTranslation = useBibleStore((state) => state.selectTranslation);
  const selectBook = useBibleStore((state) => state.selectBook);
  const selectChapter = useBibleStore((state) => state.selectChapter);
  const search = useBibleStore((state) => state.search);
  const importTranslation = useBibleStore((state) => state.importTranslation);

  const selectedBook = books.find((book) => book.id === bookId) ?? null;

  const [text, setText] = useState('');
  const debouncedText = useDebouncedValue(text);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preenchido quando o arquivo importado segue o formato "legado" (array de
  // livros, sem metadado da traducao) -- ver `lib/bible-import.ts`. Nesse
  // caso a importacao fica pendente ate' o operador preencher sigla/nome/
  // idioma no formulario abaixo.
  const [pendingLegacy, setPendingLegacy] = useState<readonly LegacyBibleBook[] | null>(null);
  const [legacyMeta, setLegacyMeta] = useState<TranslationMeta>({
    abbreviation: '',
    name: '',
    language: 'pt-BR',
  });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void search(debouncedText);
    // A busca depende do texto digitado; incluir `search` na dependencia
    // dispararia de novo a cada render porque a funcao e' recriada pela
    // store. `debouncedText` sozinho e' o gatilho certo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText]);

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) return;

    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (cause) {
        // JSON malformado nao e' um AppError do nucleo -- e' um problema no
        // proprio arquivo, detectado aqui antes de qualquer IPC.
        log.error('arquivo de traducao invalido', { detail: String(cause) });
        useBibleStore.setState({
          error: {
            code: 'INVALID_INPUT',
            message: 'O arquivo nao e um JSON valido. Veja o formato em docs/bible.md.',
          },
        });
        return;
      }

      const resultado = parseImportFile(parsed);
      if (resultado.kind === 'native') {
        void importTranslation(resultado.input);
      } else if (resultado.kind === 'legacy') {
        // Este formato (usado por varios repositorios publicos de Biblia em
        // JSON) nao carrega sigla/nome/idioma da traducao -- so' o operador
        // sabe qual arquivo baixou.
        setPendingLegacy(resultado.books);
        setLegacyMeta({ abbreviation: '', name: '', language: 'pt-BR' });
      } else {
        useBibleStore.setState({
          error: {
            code: 'INVALID_INPUT',
            message: 'Formato nao reconhecido. Veja os formatos aceitos em docs/bible.md.',
          },
        });
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmLegacyImport = (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingLegacy === null) return;
    void importTranslation(fromLegacyFormat(pendingLegacy, legacyMeta));
    setPendingLegacy(null);
  };

  return (
    <section aria-label="Navegacao da Biblia" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">Biblia</h2>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="size-4" aria-hidden />
            Importar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="Importar arquivo de traducao"
            onChange={handleImportFile}
          />
        </div>

        {pendingLegacy !== null && (
          <form
            onSubmit={handleConfirmLegacyImport}
            aria-label="Identificar a traducao importada"
            className="mb-2 flex flex-col gap-1.5 rounded-md border border-accent bg-surface-raised p-2"
          >
            <p className="text-xs text-content-muted">
              Este arquivo não diz o nome da tradução ({pendingLegacy.length} livros encontrados) —
              preencha para continuar.
            </p>
            <input
              value={legacyMeta.abbreviation}
              onChange={(event) =>
                setLegacyMeta((meta) => ({ ...meta, abbreviation: event.target.value }))
              }
              placeholder="Sigla (ex.: NVI)"
              aria-label="Sigla da tradução"
              required
              className={fieldClass}
            />
            <input
              value={legacyMeta.name}
              onChange={(event) => setLegacyMeta((meta) => ({ ...meta, name: event.target.value }))}
              placeholder="Nome (ex.: Nova Versão Internacional)"
              aria-label="Nome da tradução"
              required
              className={fieldClass}
            />
            <input
              value={legacyMeta.language}
              onChange={(event) =>
                setLegacyMeta((meta) => ({ ...meta, language: event.target.value }))
              }
              placeholder="Idioma (ex.: pt-BR)"
              aria-label="Idioma da tradução"
              required
              className={fieldClass}
            />
            <div className="flex gap-1.5">
              <Button type="submit" size="sm" className="flex-1">
                Concluir importação
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPendingLegacy(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {translations.length > 1 && (
          <select
            value={translationId ?? ''}
            onChange={(event) => void selectTranslation(event.target.value)}
            aria-label="Traducao"
            className="mb-2 w-full rounded-md border border-line bg-surface-sunken px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {translations.map((translation) => (
              <option key={translation.id} value={translation.id}>
                {translation.abbreviation} — {translation.name}
              </option>
            ))}
          </select>
        )}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-muted"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Joao 3:16 ou uma palavra"
            aria-label="Buscar na Biblia"
            disabled={translationId === null}
            className="w-full rounded-md border border-line bg-surface-sunken py-2 pl-9 pr-3 text-sm outline-none placeholder:text-content-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
        </div>

        {selectedBook !== null && (
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="bible-chapter" className="text-xs text-content-muted">
              Capitulo
            </label>
            <select
              id="bible-chapter"
              value={chapter ?? 1}
              onChange={(event) => void selectChapter(Number(event.target.value))}
              className="rounded-md border border-line bg-surface-sunken px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {Array.from({ length: selectedBook.chapterCount }, (_, index) => index + 1).map(
                (number) => (
                  <option key={number} value={number}>
                    {number}
                  </option>
                ),
              )}
            </select>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {translations.length === 0 ? (
          <div className="flex flex-col gap-2 p-3 text-xs text-content-muted">
            <p>Nenhuma traducao importada.</p>
            <p>
              Importe um arquivo de traducao que sua igreja tenha os direitos de usar. O formato
              esta documentado em <code>docs/bible.md</code>.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {books.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => void selectBook(book.id)}
                  aria-current={book.id === bookId ? 'true' : undefined}
                  className={cn(
                    'w-full px-3 py-1.5 text-left text-sm hover:bg-surface-raised',
                    book.id === bookId && 'bg-surface-raised text-accent',
                  )}
                >
                  {book.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error !== null && (
        <p role="alert" className="border-t border-line px-3 py-2 text-xs text-live">
          {error.message}
        </p>
      )}
    </section>
  );
}
