/**
 * Contrato da busca de letra num servico externo.
 *
 * Espelha `apps/desktop/src-tauri/src/lyrics/mod.rs` -- ver esse arquivo para
 * o risco de direitos autorais aceito ao adicionar esta busca.
 */

export interface LyricsSearchResult {
  readonly trackName: string;
  readonly artistName: string;
  readonly albumName: string | null;
  readonly lyrics: string;
}
