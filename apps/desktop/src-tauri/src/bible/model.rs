//! Modelo de dominio da Biblia.
//!
//! Cada struct daqui tem espelho em `@holy-media/types`.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BibleTranslation {
    pub id: String,
    pub abbreviation: String,
    pub name: String,
    pub language: String,
    pub imported_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BibleBook {
    pub id: String,
    pub translation_id: String,
    /// Ordem canonica (Genesis = 1, Apocalipse = 66). Nunca a ordem alfabetica.
    pub position: i64,
    pub name: String,
    pub abbreviation: String,
    pub chapter_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BibleVerse {
    pub id: String,
    pub book_id: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
}

/// Um resultado de busca: o versiculo mais a localizacao para exibir
/// ("João 3:16"), sem obrigar quem chama a buscar o livro de novo.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BibleVerseMatch {
    pub verse: BibleVerse,
    pub book_name: String,
    pub book_abbreviation: String,
}

/// Resultado de resolver uma referencia ("João 3:16", "Salmos 23").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BibleReferenceResult {
    pub book: BibleBook,
    pub chapter: i64,
    /// Um versiculo, uma faixa, ou o capitulo inteiro quando a referencia nao
    /// especifica versiculo ("Salmos 23").
    pub verses: Vec<BibleVerse>,
}

// --- entrada de importacao -------------------------------------------------

/// Formato de importacao de uma traducao completa.
///
/// Documentado em `docs/bible.md`. E' o unico jeito de colocar texto biblico
/// no aplicativo -- nao ha traducao embutida no instalador.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleImportInput {
    pub abbreviation: String,
    pub name: String,
    pub language: String,
    pub books: Vec<BibleBookImportInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleBookImportInput {
    pub name: String,
    pub abbreviation: String,
    /// Um item por capitulo; cada item e' a lista de versiculos daquele
    /// capitulo, em ordem (posicao 0 = versiculo 1).
    pub chapters: Vec<Vec<String>>,
}

const MAX_NAME_LEN: usize = 200;

impl BibleImportInput {
    /// Valida a traducao inteira antes de qualquer escrita no banco --
    /// melhor recusar um arquivo mal formado de uma vez do que descobrir no
    /// meio da importacao com metade dos livros ja gravados.
    pub fn validated(self) -> AppResult<Self> {
        let abbreviation = self.abbreviation.trim();
        if abbreviation.is_empty() {
            return Err(AppError::invalid("A traducao precisa de uma sigla."));
        }
        if abbreviation.chars().count() > 20 {
            return Err(AppError::invalid("A sigla da traducao e' longa demais."));
        }

        let name = self.name.trim();
        if name.is_empty() {
            return Err(AppError::invalid("A traducao precisa de um nome."));
        }
        if name.chars().count() > MAX_NAME_LEN {
            return Err(AppError::invalid("O nome da traducao e' longo demais."));
        }

        if self.books.is_empty() {
            return Err(AppError::invalid(
                "A traducao precisa de pelo menos um livro.",
            ));
        }

        for book in &self.books {
            if book.name.trim().is_empty() {
                return Err(AppError::invalid("Todo livro precisa de um nome."));
            }
            if book.abbreviation.trim().is_empty() {
                return Err(AppError::invalid("Todo livro precisa de uma sigla."));
            }
            if book.chapters.is_empty() {
                return Err(AppError::invalid(format!(
                    "O livro \"{}\" nao tem nenhum capitulo.",
                    book.name.trim()
                )));
            }
            for (index, chapter) in book.chapters.iter().enumerate() {
                if chapter.is_empty() {
                    return Err(AppError::invalid(format!(
                        "O capitulo {} de \"{}\" nao tem nenhum versiculo.",
                        index + 1,
                        book.name.trim()
                    )));
                }
                if chapter.iter().any(|verse| verse.trim().is_empty()) {
                    return Err(AppError::invalid(format!(
                        "O capitulo {} de \"{}\" tem um versiculo vazio.",
                        index + 1,
                        book.name.trim()
                    )));
                }
            }
        }

        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn traducao_valida() -> BibleImportInput {
        BibleImportInput {
            abbreviation: "TST".to_owned(),
            name: "Traducao de Teste".to_owned(),
            language: "pt-BR".to_owned(),
            books: vec![BibleBookImportInput {
                name: "Livro Um".to_owned(),
                abbreviation: "Lv1".to_owned(),
                chapters: vec![vec!["Primeiro versiculo".to_owned()]],
            }],
        }
    }

    #[test]
    fn traducao_valida_passa() {
        assert!(traducao_valida().validated().is_ok());
    }

    #[test]
    fn sigla_vazia_e_recusada() {
        let mut entrada = traducao_valida();
        entrada.abbreviation = "  ".to_owned();
        let erro = entrada.validated().expect_err("deveria recusar");
        assert_eq!(erro.code, crate::error::AppErrorCode::InvalidInput);
    }

    #[test]
    fn sem_nenhum_livro_e_recusada() {
        let mut entrada = traducao_valida();
        entrada.books = Vec::new();
        assert!(entrada.validated().is_err());
    }

    #[test]
    fn livro_sem_capitulo_e_recusado() {
        let mut entrada = traducao_valida();
        entrada.books[0].chapters = Vec::new();
        let erro = entrada.validated().expect_err("deveria recusar");
        assert!(erro.message.contains("Livro Um"));
    }

    #[test]
    fn capitulo_vazio_e_recusado() {
        let mut entrada = traducao_valida();
        entrada.books[0].chapters = vec![Vec::new()];
        assert!(entrada.validated().is_err());
    }

    #[test]
    fn versiculo_em_branco_e_recusado() {
        let mut entrada = traducao_valida();
        entrada.books[0].chapters = vec![vec!["texto".to_owned(), "   ".to_owned()]];
        assert!(entrada.validated().is_err());
    }
}
