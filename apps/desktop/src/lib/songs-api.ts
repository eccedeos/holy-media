import type { Song, SongInput, SongSummary } from '@holy-media/types';
import { invokeCommand } from './ipc';

/**
 * Chamadas de musicas para o nucleo Rust.
 *
 * Uma funcao por comando, sem logica: quem decide o que fazer com o resultado
 * e' a store. Isso mantem os testes de store livres do Tauri.
 */

export function searchSongs(query: string): Promise<SongSummary[]> {
  return invokeCommand<SongSummary[]>('songs_search', { query });
}

export function getSong(id: string): Promise<Song> {
  return invokeCommand<Song>('songs_get', { id });
}

export function createSong(input: SongInput): Promise<Song> {
  return invokeCommand<Song>('songs_create', { input });
}

export function updateSong(id: string, input: SongInput): Promise<Song> {
  return invokeCommand<Song>('songs_update', { id, input });
}

export function deleteSong(id: string): Promise<void> {
  return invokeCommand<void>('songs_delete', { id });
}

/** Alterna o favorito. Devolve o novo estado. */
export function toggleSongFavorite(id: string): Promise<boolean> {
  return invokeCommand<boolean>('songs_toggle_favorite', { id });
}

/** Registra que a musica foi usada, alimentando "usadas recentemente". */
export function registerSongUsage(id: string): Promise<void> {
  return invokeCommand<void>('songs_register_usage', { id });
}

export function listFavoriteSongs(): Promise<SongSummary[]> {
  return invokeCommand<SongSummary[]>('songs_list_favorites');
}

export function listRecentlyUsedSongs(): Promise<SongSummary[]> {
  return invokeCommand<SongSummary[]>('songs_list_recently_used');
}

/** Entrada vazia, usada como ponto de partida do formulario de cadastro. */
export function emptySongInput(): SongInput {
  return {
    title: '',
    artist: '',
    author: '',
    category: '',
    favorite: false,
    tags: [],
    slides: [],
  };
}
