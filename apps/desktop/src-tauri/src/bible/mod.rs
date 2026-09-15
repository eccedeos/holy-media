//! Dominio da Biblia: traducoes, livros, versiculos, busca e referencia.
//!
//! Este projeto nao distribui nenhuma traducao **protegida** com o
//! instalador -- ver `docs/bible.md`. A unica excecao e' a Traducao
//! Brasileira (TB), oferecida como seed opcional em `bible::seed` porque a
//! fonte de origem a marca explicitamente como dominio publico. Qualquer
//! outra traducao entra por importacao.

pub mod model;
pub mod reference;
pub mod repository;
pub mod seed;

#[cfg(test)]
mod tests;

pub use model::{
    BibleBook, BibleImportInput, BibleReferenceResult, BibleTranslation, BibleVerse,
    BibleVerseMatch,
};
