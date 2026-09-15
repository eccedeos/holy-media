//! Comando de busca de letra num servico externo.
//!
//! Ver `crate::lyrics` para o porque desta busca existir (e o risco aceito ao
//! adiciona-la).

use crate::error::{AppError, AppErrorCode, AppResult};
use crate::lyrics::{self, LyricsSearchResult};

/// `async` de proposito: a busca faz uma chamada de rede que pode levar
/// segundos, e a chamada nativa e' bloqueante (`ureq`). Um comando sincrono
/// aqui bloquearia a thread que processa IPC pelo tempo da requisicao -- a
/// mesma classe de problema que travava a janela de projecao no Windows (ver
/// `display::open`), so' que disparada por rede lenta em vez de uma chamada
/// de janela. `spawn_blocking` tira a chamada da thread principal.
#[tauri::command]
pub async fn lyrics_search(query: String) -> AppResult<Vec<LyricsSearchResult>> {
    tauri::async_runtime::spawn_blocking(move || lyrics::search(&query))
        .await
        .map_err(|error| {
            AppError::new(
                AppErrorCode::LyricsSearchFailed,
                "Nao foi possivel buscar a letra. Verifique a conexao com a internet.",
            )
            .with_detail(error.to_string())
        })?
}
