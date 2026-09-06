//! Nucleo Rust do Holy Media.
//!
//! Na Fase 0 este modulo faz apenas o essencial: sobe a janela e expoe o
//! handshake `app_info`, que prova que a ponte interface <-> nucleo funciona.
//! O acesso ao SQLite, o Presentation Engine e o controle da segunda tela
//! entram aqui nas fases seguintes, cada um em seu proprio modulo.

mod commands;

pub use commands::AppInfo;

/// Sobe a aplicacao Tauri.
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::app_info])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar a aplicacao Tauri");
}
