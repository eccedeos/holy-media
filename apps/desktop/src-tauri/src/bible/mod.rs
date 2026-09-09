//! Dominio da Biblia: traducoes, livros, versiculos, busca e referencia.
//!
//! Este projeto nao distribui nenhuma traducao com o instalador -- ver
//! `docs/bible.md`. O conteudo entra por importacao.

pub mod model;
pub mod reference;
pub mod repository;

#[cfg(test)]
mod tests;

pub use model::{
    BibleBook, BibleImportInput, BibleReferenceResult, BibleTranslation, BibleVerse,
    BibleVerseMatch,
};
