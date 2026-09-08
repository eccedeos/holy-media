//! Ordem do culto: playlist que amarra itens (hoje, musicas) numa sequencia.

pub mod model;
pub mod repository;

#[cfg(test)]
mod tests;

pub use model::{Service, ServiceInput, ServiceSummary};
