//! Estado compartilhado entre os comandos.

use std::sync::Mutex;

use crate::db::Database;
use crate::presentation::PresentationEngine;

/// O que os comandos recebem via `State<'_, AppState>`.
pub struct AppState {
    pub db: Database,
    /// O motor de apresentacao e' a fonte unica da verdade sobre o que esta na
    /// tela. O Control Room, a segunda tela e (na Fase 3) o celular sao todos
    /// observadores dele -- nenhum guarda a sua propria copia do slide atual.
    pub presentation: Mutex<PresentationEngine>,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            presentation: Mutex::new(PresentationEngine::new()),
        }
    }

    /// Executa `operation` com o motor travado.
    ///
    /// Um mutex envenenado significa que outra operacao entrou em panico
    /// segurando a trava. Derrubar o app no meio de um culto por causa disso
    /// seria pior do que seguir com o motor como ele ficou.
    pub fn with_presentation<T>(&self, operation: impl FnOnce(&mut PresentationEngine) -> T) -> T {
        let mut engine = self
            .presentation
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        operation(&mut engine)
    }
}
