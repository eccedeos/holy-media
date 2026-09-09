import type {
  BibleBook,
  BibleImportInput,
  BibleReferenceResult,
  BibleTranslation,
  BibleVerse,
  BibleVerseMatch,
} from '@holy-media/types';
import { invokeCommand } from './ipc';

/** Chamadas da Biblia para o nucleo Rust. */

export function listBibleTranslations(): Promise<BibleTranslation[]> {
  return invokeCommand<BibleTranslation[]>('bible_list_translations');
}

export function importBibleTranslation(input: BibleImportInput): Promise<BibleTranslation> {
  return invokeCommand<BibleTranslation>('bible_import_translation', { input });
}

export function deleteBibleTranslation(id: string): Promise<void> {
  return invokeCommand<void>('bible_delete_translation', { id });
}

export function listBibleBooks(translationId: string): Promise<BibleBook[]> {
  return invokeCommand<BibleBook[]>('bible_list_books', { translationId });
}

export function getBibleChapter(bookId: string, chapter: number): Promise<BibleVerse[]> {
  return invokeCommand<BibleVerse[]>('bible_get_chapter', { bookId, chapter });
}

export function searchBible(translationId: string, query: string): Promise<BibleVerseMatch[]> {
  return invokeCommand<BibleVerseMatch[]>('bible_search', { translationId, query });
}

/**
 * Resolve uma referencia digitada ("João 3:16", "Salmos 23") contra uma
 * traducao. Usado para a previa; a apresentacao de verdade resolve de novo
 * no nucleo, a partir do id, em vez de aceitar o texto do versiculo daqui.
 */
export function resolveBibleReference(
  translationId: string,
  reference: string,
): Promise<BibleReferenceResult> {
  return invokeCommand<BibleReferenceResult>('bible_resolve_reference', {
    translationId,
    reference,
  });
}
