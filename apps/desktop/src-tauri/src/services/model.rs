//! Modelo de dominio da ordem do culto.
//!
//! Cada struct daqui tem espelho em `@holy-media/types`.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// Tipo de item na ordem do culto. Hoje so' musica; Biblia, texto, imagem e
/// QR Code entram nas fases em que forem implementados.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ServiceItemKind {
    Song,
}

impl ServiceItemKind {
    pub(super) fn as_sql(&self) -> &'static str {
        match self {
            Self::Song => "song",
        }
    }

    pub(super) fn from_sql(value: &str) -> AppResult<Self> {
        match value {
            "song" => Ok(Self::Song),
            other => Err(AppError::new(
                crate::error::AppErrorCode::DatabaseFailed,
                "A ordem do culto contem um item de tipo desconhecido.",
            )
            .with_detail(format!("kind inesperado: {other}"))),
        }
    }
}

/// Um item da ordem do culto.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceItem {
    pub id: String,
    pub position: i64,
    pub kind: ServiceItemKind,
    /// Id da entidade de origem (hoje, `songs.id`). `None` seria o caso de um
    /// item sem origem -- ainda nao existe, mas o texto livre da Fase 1 vai
    /// precisar disto.
    pub reference_id: Option<String>,
    /// Copiado no momento em que o item entra na lista. Se a musica for
    /// renomeada depois, a ordem do culto ja preparada continua legivel.
    pub title: String,
}

/// A ordem do culto, com metadados e itens.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub title: String,
    pub items: Vec<ServiceItem>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Versao enxuta para listas. Sem os itens: a tela que lista os cultos
/// salvos nao precisa da playlist inteira de cada um.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSummary {
    pub id: String,
    pub title: String,
    pub item_count: i64,
    pub updated_at: i64,
}

/// Titulo maior que isto e' quase certamente um erro de digitacao.
const MAX_TITLE_LEN: usize = 200;

/// Entrada para criar ou renomear um culto.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInput {
    pub title: String,
}

impl ServiceInput {
    pub fn sanitized(self) -> AppResult<Self> {
        let title = self.title.trim().to_owned();
        if title.is_empty() {
            return Err(AppError::invalid("O culto precisa de um titulo."));
        }
        if title.chars().count() > MAX_TITLE_LEN {
            return Err(AppError::invalid("O titulo do culto e' longo demais."));
        }
        Ok(Self { title })
    }
}
