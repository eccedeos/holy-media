//! Nucleo Rust do Holy Media.
//!
//! Responsabilidades atuais: subir a janela do operador, abrir o banco local e
//! expor os comandos de musicas. O Presentation Engine e a segunda tela entram
//! nos proximos passos da Fase 1, cada um em seu proprio modulo.

mod commands;
mod db;
mod error;
mod songs;
mod state;

pub use commands::AppInfo;
pub use error::{AppError, AppErrorCode, AppResult};

use tauri::Manager;

/// Nome do arquivo do banco dentro do diretorio de dados da aplicacao.
const DATABASE_FILE: &str = "holy-media.db";

/// Sobe a aplicacao Tauri.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;

            let database = db::Database::open(data_dir.join(DATABASE_FILE))?;
            app.manage(state::AppState { db: database });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::songs::songs_search,
            commands::songs::songs_get,
            commands::songs::songs_create,
            commands::songs::songs_update,
            commands::songs::songs_delete,
            commands::songs::songs_toggle_favorite,
            commands::songs::songs_register_usage,
            commands::songs::songs_list_favorites,
            commands::songs::songs_list_recently_used,
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar a aplicacao Tauri");
}
