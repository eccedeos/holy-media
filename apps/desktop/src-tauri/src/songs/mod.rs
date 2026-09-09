//! Dominio de musicas: modelo, persistencia e busca.

pub mod model;
pub mod repository;
pub mod seed;

#[cfg(test)]
mod tests;

pub use model::{Song, SongInput, SongSummary};
