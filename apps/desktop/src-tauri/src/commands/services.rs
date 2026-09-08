//! Comandos da ordem do culto expostos a interface.

use tauri::State;

use crate::error::AppResult;
use crate::services::{repository, Service, ServiceInput, ServiceSummary};
use crate::state::AppState;

#[tauri::command]
pub fn services_list(state: State<'_, AppState>) -> AppResult<Vec<ServiceSummary>> {
    repository::list(&state.db)
}

#[tauri::command]
pub fn services_get(state: State<'_, AppState>, id: String) -> AppResult<Service> {
    repository::get(&state.db, &id)
}

#[tauri::command]
pub fn services_create(state: State<'_, AppState>, input: ServiceInput) -> AppResult<Service> {
    repository::create(&state.db, input)
}

#[tauri::command]
pub fn services_rename(
    state: State<'_, AppState>,
    id: String,
    input: ServiceInput,
) -> AppResult<Service> {
    repository::rename(&state.db, &id, input)
}

#[tauri::command]
pub fn services_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    repository::delete(&state.db, &id)
}

#[tauri::command]
pub fn services_add_song(
    state: State<'_, AppState>,
    service_id: String,
    song_id: String,
) -> AppResult<Service> {
    repository::add_song(&state.db, &service_id, &song_id)
}

#[tauri::command]
pub fn services_remove_item(
    state: State<'_, AppState>,
    service_id: String,
    item_id: String,
) -> AppResult<Service> {
    repository::remove_item(&state.db, &service_id, &item_id)
}

#[tauri::command]
pub fn services_duplicate_item(
    state: State<'_, AppState>,
    service_id: String,
    item_id: String,
) -> AppResult<Service> {
    repository::duplicate_item(&state.db, &service_id, &item_id)
}

#[tauri::command]
pub fn services_move_item(
    state: State<'_, AppState>,
    service_id: String,
    item_id: String,
    new_position: i64,
) -> AppResult<Service> {
    repository::move_item(&state.db, &service_id, &item_id, new_position)
}
