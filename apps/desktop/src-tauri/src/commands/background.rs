//! Comandos do fundo da projecao.

use tauri::{AppHandle, Emitter, State};

use crate::background::{repository, BackgroundInput, BackgroundSettings};
use crate::error::AppResult;
use crate::state::AppState;

/// Evento emitido quando o fundo muda. O Control Room e a janela de projecao
/// escutam, no mesmo padrao de `presentation:state`.
const BACKGROUND_EVENT: &str = "background:changed";

#[tauri::command]
pub fn background_get(state: State<'_, AppState>) -> AppResult<BackgroundSettings> {
    repository::get(&state.db)
}

#[tauri::command]
pub fn background_set(
    app: AppHandle,
    state: State<'_, AppState>,
    input: BackgroundInput,
) -> AppResult<BackgroundSettings> {
    let settings = repository::set(&state.db, input)?;
    // Falhar ao emitir nao pode bloquear a troca: o fundo ja foi salvo, e a
    // proxima leitura (ou o proximo evento) realinha as janelas.
    let _ = app.emit(BACKGROUND_EVENT, &settings);
    Ok(settings)
}
