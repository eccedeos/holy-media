//! Erros que atravessam a fronteira nucleo -> interface.
//!
//! Regra da secao 22 do briefing: o operador nunca ve stack trace. Por isso
//! todo erro vira um `AppError` com tres partes -- `code` para a logica da
//! interface decidir o que fazer, `message` em portugues para a tela, e
//! `detail` tecnico que so existe para o log.

use serde::Serialize;

/// Erro serializavel. Espelha `AppError` em `@holy-media/types`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AppErrorCode {
    /// Falha ao abrir, migrar ou consultar o banco local.
    DatabaseFailed,
    /// A entidade pedida nao existe (musica ja excluida, id invalido).
    NotFound,
    /// O dado enviado pela interface nao passa nas regras do dominio.
    InvalidInput,
}

impl AppError {
    pub fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            detail: None,
        }
    }

    /// Anexa o detalhe tecnico. Ele vai para o log, nunca para a tela.
    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    pub fn not_found(what: impl Into<String>) -> Self {
        Self::new(AppErrorCode::NotFound, what)
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new(AppErrorCode::InvalidInput, message)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

/// Qualquer falha do SQLite vira a mesma mensagem amigavel; o texto do driver
/// -- que nao ajuda o operador em nada -- fica retido no `detail`.
impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new(
            AppErrorCode::DatabaseFailed,
            "Nao foi possivel acessar a biblioteca local.",
        )
        .with_detail(error.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn erro_de_sqlite_nao_vaza_detalhe_tecnico_para_a_mensagem() {
        let sqlite_error = rusqlite::Error::InvalidQuery;
        let app_error: AppError = sqlite_error.into();

        assert_eq!(app_error.code, AppErrorCode::DatabaseFailed);
        assert_eq!(
            app_error.message,
            "Nao foi possivel acessar a biblioteca local."
        );
        assert!(app_error.detail.is_some());
    }

    #[test]
    fn detalhe_ausente_some_do_json() {
        let json = serde_json::to_value(AppError::not_found("Musica nao encontrada."))
            .expect("AppError deve serializar");

        assert_eq!(json["code"], "NOT_FOUND");
        assert_eq!(json["message"], "Musica nao encontrada.");
        assert!(json.get("detail").is_none());
    }
}
