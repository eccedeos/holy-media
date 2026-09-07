//! Comandos de musicas expostos a interface.
//!
//! Camada fina de proposito: ela apenas traduz IPC para chamadas do
//! repositorio. Toda regra de dominio fica em `songs::`, onde da' para testar
//! sem subir uma janela.

use tauri::State;

use crate::error::AppResult;
use crate::songs::{repository, Song, SongInput, SongSummary};
use crate::state::AppState;

/// Quantas musicas "usadas recentemente" a tela mostra.
const RECENT_LIMIT: usize = 20;

#[tauri::command]
pub fn songs_search(state: State<'_, AppState>, query: String) -> AppResult<Vec<SongSummary>> {
    repository::search(&state.db, &query)
}

#[tauri::command]
pub fn songs_get(state: State<'_, AppState>, id: String) -> AppResult<Song> {
    repository::get(&state.db, &id)
}

#[tauri::command]
pub fn songs_create(state: State<'_, AppState>, input: SongInput) -> AppResult<Song> {
    repository::create(&state.db, input)
}

#[tauri::command]
pub fn songs_update(state: State<'_, AppState>, id: String, input: SongInput) -> AppResult<Song> {
    repository::update(&state.db, &id, input)
}

#[tauri::command]
pub fn songs_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    repository::delete(&state.db, &id)
}

#[tauri::command]
pub fn songs_toggle_favorite(state: State<'_, AppState>, id: String) -> AppResult<bool> {
    repository::toggle_favorite(&state.db, &id)
}

#[tauri::command]
pub fn songs_register_usage(state: State<'_, AppState>, id: String) -> AppResult<()> {
    repository::register_usage(&state.db, &id)
}

#[tauri::command]
pub fn songs_list_favorites(state: State<'_, AppState>) -> AppResult<Vec<SongSummary>> {
    repository::list_favorites(&state.db)
}

#[tauri::command]
pub fn songs_list_recently_used(state: State<'_, AppState>) -> AppResult<Vec<SongSummary>> {
    repository::list_recently_used(&state.db, RECENT_LIMIT)
}
