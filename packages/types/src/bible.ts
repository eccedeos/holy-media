/**
 * Contratos da Biblia.
 *
 * Espelham `apps/desktop/src-tauri/src/bible/model.rs`. Este projeto nao
 * distribui nenhuma traducao com o instalador -- ver `docs/bible.md`. O
 * conteudo entra por importacao, no formato de `BibleImportInput`.
 */

export interface BibleTranslation {
  readonly id: string;
  readonly abbreviation: string;
  readonly name: string;
  readonly language: string;
  readonly importedAt: number;
}

export interface BibleBook {
  readonly id: string;
  readonly translationId: string;
  /** Ordem canonica (Genesis = 1, Apocalipse = 66). Nunca a ordem alfabetica. */
  readonly position: number;
  readonly name: string;
  readonly abbreviation: string;
  readonly chapterCount: number;
}

export interface BibleVerse {
  readonly id: string;
  readonly bookId: string;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

/** Um resultado de busca: o versiculo mais a localizacao para exibir. */
export interface BibleVerseMatch {
  readonly verse: BibleVerse;
  readonly bookName: string;
  readonly bookAbbreviation: string;
}

/** Resultado de resolver uma referencia ("João 3:16", "Salmos 23"). */
export interface BibleReferenceResult {
  readonly book: BibleBook;
  readonly chapter: number;
  /** Um versiculo, uma faixa, ou o capitulo inteiro. */
  readonly verses: readonly BibleVerse[];
}

/** Formato de importacao de um livro dentro de uma traducao. */
export interface BibleBookImportInput {
  readonly name: string;
  readonly abbreviation: string;
  /** Um item por capitulo; cada item e' a lista de versiculos daquele capitulo. */
  readonly chapters: readonly (readonly string[])[];
}

/** Formato de importacao de uma traducao completa. Ver `docs/bible.md`. */
export interface BibleImportInput {
  readonly abbreviation: string;
  readonly name: string;
  readonly language: string;
  readonly books: readonly BibleBookImportInput[];
}
