//! Estado compartilhado entre os comandos.

use crate::db::Database;

/// O que os comandos recebem via `State<'_, AppState>`.
pub struct AppState {
    pub db: Database,
}
