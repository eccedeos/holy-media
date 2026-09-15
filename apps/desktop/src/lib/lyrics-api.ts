import type { LyricsSearchResult } from '@holy-media/types';
import { invokeCommand } from './ipc';

/**
 * Busca letra num servico externo -- ver `crate::lyrics` no nucleo Rust para
 * o risco de direitos autorais aceito ao adicionar esta busca. So' preenche o
 * formulario de cadastro; nada e' salvo so' por ter sido buscado.
 */
export function searchLyricsOnline(query: string): Promise<LyricsSearchResult[]> {
  return invokeCommand<LyricsSearchResult[]>('lyrics_search', { query });
}
