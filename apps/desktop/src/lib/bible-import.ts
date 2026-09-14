import type { BibleImportInput } from '@holy-media/types';

/**
 * Compatibilidade com o formato de Bíblia em JSON mais comum fora deste
 * projeto -- um array de livros (`[{abbrev, name, chapters}, ...]`), sem
 * metadado da tradução como um todo. É o formato usado por
 * `thiagobodruk/biblia`, `damarals/biblias` e a maioria dos forks: quem
 * procurar "bíblia json" no GitHub tem grande chance de cair nele. Aceitar
 * os dois formatos de propósito -- fazer o operador converter o arquivo à
 * mão antes de importar seria fricção que ninguém pediria de verdade.
 *
 * O núcleo Rust continua validando **só** o formato nativo
 * (`BibleImportInput`, documentado em `docs/bible.md`): a conversão é
 * responsabilidade da interface, não do domínio -- mesmo raciocínio já
 * usado para `parseLyrics` (texto de música) e para o desenho do QR Code.
 */

export interface LegacyBibleBook {
  readonly abbrev: string;
  /** As duas fontes conhecidas usam `name`; nunca vimos `book`, mas o
   * README de uma delas documenta esse nome alternativo -- aceitar os dois
   * custa uma linha e evita um import que falha por um detalhe bobo. */
  readonly name?: string;
  readonly book?: string;
  readonly chapters: readonly (readonly string[])[];
}

/** Metadados que só existem no formato nativo -- o legado não os carrega,
 * então precisam vir de quem está importando. */
export interface TranslationMeta {
  readonly abbreviation: string;
  readonly name: string;
  readonly language: string;
}

export type ParsedImportFile =
  | { readonly kind: 'native'; readonly input: BibleImportInput }
  | { readonly kind: 'legacy'; readonly books: readonly LegacyBibleBook[] }
  | { readonly kind: 'invalid' };

function isLegacyBook(value: unknown): value is LegacyBibleBook {
  if (typeof value !== 'object' || value === null) return false;
  const book = value as Record<string, unknown>;
  return (
    typeof book['abbrev'] === 'string' &&
    Array.isArray(book['chapters']) &&
    (typeof book['name'] === 'string' || typeof book['book'] === 'string')
  );
}

function isNativeInput(value: unknown): value is BibleImportInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input['abbreviation'] === 'string' &&
    typeof input['name'] === 'string' &&
    typeof input['language'] === 'string' &&
    Array.isArray(input['books'])
  );
}

/**
 * Reconhece qual dos dois formatos um JSON já lido (`JSON.parse`) segue.
 * Não valida conteúdo além da forma -- a validação de verdade (livro sem
 * capítulo, versículo vazio...) continua sendo o núcleo, para as duas
 * entradas passarem pela mesma regra depois de convertidas.
 */
export function parseImportFile(raw: unknown): ParsedImportFile {
  if (isNativeInput(raw)) return { kind: 'native', input: raw };
  if (Array.isArray(raw) && raw.length > 0 && raw.every(isLegacyBook)) {
    return { kind: 'legacy', books: raw };
  }
  return { kind: 'invalid' };
}

/** Nome do livro no formato legado: `name` quando existe, `book` senão. */
function legacyBookName(book: LegacyBibleBook): string {
  return book.name ?? book.book ?? '';
}

/** Monta o formato nativo a partir do legado, com os metadados que o
 * operador preencheu no formulário de importação. */
export function fromLegacyFormat(
  books: readonly LegacyBibleBook[],
  meta: TranslationMeta,
): BibleImportInput {
  return {
    abbreviation: meta.abbreviation,
    name: meta.name,
    language: meta.language,
    books: books.map((book) => ({
      name: legacyBookName(book),
      abbreviation: book.abbrev,
      chapters: book.chapters,
    })),
  };
}
