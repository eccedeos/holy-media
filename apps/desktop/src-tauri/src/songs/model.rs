//! Modelo de dominio das musicas.
//!
//! Cada struct daqui tem espelho em `@holy-media/types`. A serializacao usa
//! `camelCase` para que o TypeScript receba o formato que ja espera.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// Um slide e' o bloco de letra que aparece de uma vez na tela.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SongSlide {
    pub id: String,
    /// Ordem de projecao, comecando em zero.
    pub position: i64,
    /// Marcacao que o operador le na lateral: "Verso 1", "Refrao", "Ponte".
    pub label: String,
    pub content: String,
}

/// Musica com toda a letra. E' o que a tela de edicao recebe.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub author: String,
    pub category: String,
    pub favorite: bool,
    pub tags: Vec<String>,
    pub slides: Vec<SongSlide>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Versao enxuta para listas e resultados de busca.
///
/// Existe por causa do orcamento de memoria: a lista da biblioteca pode ter
/// milhares de linhas, e mandar a letra inteira de cada musica pelo IPC so
/// para desenhar um titulo seria desperdicio dos caros.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SongSummary {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub favorite: bool,
    pub slide_count: i64,
    pub updated_at: i64,
}

/// Dados de entrada para criar ou atualizar uma musica.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SongInput {
    pub title: String,
    #[serde(default)]
    pub artist: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub slides: Vec<SlideInput>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SlideInput {
    #[serde(default)]
    pub label: String,
    pub content: String,
}

/// Titulo maior que isto e' quase certamente um erro de importacao -- um
/// arquivo inteiro colado no campo errado, por exemplo.
const MAX_TITLE_LEN: usize = 200;

impl SongInput {
    /// Normaliza e valida a entrada antes de encostar no banco.
    ///
    /// Devolve a propria entrada limpa: espacos aparados, slides vazios
    /// descartados e tags sem repeticao. Assim o repositorio recebe dado ja
    /// confiavel e nao precisa validar de novo.
    pub fn sanitized(self) -> AppResult<Self> {
        let title = self.title.trim().to_owned();
        if title.is_empty() {
            return Err(AppError::invalid("A musica precisa de um titulo."));
        }
        if title.chars().count() > MAX_TITLE_LEN {
            return Err(AppError::invalid("O titulo da musica e' longo demais."));
        }

        // Um slide em branco no meio da musica projetaria uma tela vazia no
        // culto. Melhor descartar na entrada do que descobrir ao vivo.
        let slides: Vec<SlideInput> = self
            .slides
            .into_iter()
            .filter_map(|slide| {
                let content = slide.content.trim();
                if content.is_empty() {
                    return None;
                }
                Some(SlideInput {
                    label: slide.label.trim().to_owned(),
                    content: content.to_owned(),
                })
            })
            .collect();

        let mut tags: Vec<String> = Vec::new();
        for tag in self.tags {
            let tag = tag.trim().to_owned();
            if tag.is_empty() {
                continue;
            }
            // Comparacao sem caixa: "Natal" e "natal" sao a mesma tag.
            if !tags
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&tag))
            {
                tags.push(tag);
            }
        }

        Ok(Self {
            title,
            artist: self.artist.trim().to_owned(),
            author: self.author.trim().to_owned(),
            category: self.category.trim().to_owned(),
            favorite: self.favorite,
            tags,
            slides,
        })
    }

    /// Letra inteira em texto corrido. E' o que vai para o indice de busca,
    /// permitindo achar a musica por um trecho que atravessa slides.
    pub fn lyrics(&self) -> String {
        self.slides
            .iter()
            .map(|slide| slide.content.as_str())
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entrada(title: &str) -> SongInput {
        SongInput {
            title: title.to_owned(),
            ..Default::default()
        }
    }

    #[test]
    fn titulo_vazio_e_recusado() {
        let erro = entrada("   ").sanitized().expect_err("deveria recusar");
        assert_eq!(erro.message, "A musica precisa de um titulo.");
    }

    #[test]
    fn titulo_absurdamente_longo_e_recusado() {
        let erro = entrada(&"a".repeat(MAX_TITLE_LEN + 1))
            .sanitized()
            .expect_err("deveria recusar");
        assert_eq!(erro.code, crate::error::AppErrorCode::InvalidInput);
    }

    #[test]
    fn espacos_ao_redor_dos_campos_sao_aparados() {
        let limpa = SongInput {
            title: "  Grande e o Senhor  ".to_owned(),
            artist: "  Adhemar de Campos ".to_owned(),
            ..Default::default()
        }
        .sanitized()
        .expect("deveria aceitar");

        assert_eq!(limpa.title, "Grande e o Senhor");
        assert_eq!(limpa.artist, "Adhemar de Campos");
    }

    #[test]
    fn slides_em_branco_sao_descartados() {
        let limpa = SongInput {
            title: "Musica".to_owned(),
            slides: vec![
                SlideInput {
                    label: "Verso 1".to_owned(),
                    content: "Primeira linha".to_owned(),
                },
                SlideInput {
                    label: String::new(),
                    content: "   ".to_owned(),
                },
                SlideInput {
                    label: " Refrao ".to_owned(),
                    content: " Aleluia ".to_owned(),
                },
            ],
            ..Default::default()
        }
        .sanitized()
        .expect("deveria aceitar");

        assert_eq!(
            limpa.slides.len(),
            2,
            "o slide vazio projetaria uma tela em branco"
        );
        assert_eq!(limpa.slides[1].label, "Refrao");
        assert_eq!(limpa.slides[1].content, "Aleluia");
    }

    #[test]
    fn tags_repetidas_ignoram_a_caixa() {
        let limpa = SongInput {
            title: "Musica".to_owned(),
            tags: vec![
                "Natal".into(),
                " natal ".into(),
                "NATAL".into(),
                "Ceia".into(),
            ],
            ..Default::default()
        }
        .sanitized()
        .expect("deveria aceitar");

        assert_eq!(limpa.tags, vec!["Natal".to_owned(), "Ceia".to_owned()]);
    }

    #[test]
    fn a_letra_indexada_junta_todos_os_slides() {
        let entrada = SongInput {
            title: "Musica".to_owned(),
            slides: vec![
                SlideInput {
                    label: String::new(),
                    content: "primeira".to_owned(),
                },
                SlideInput {
                    label: String::new(),
                    content: "segunda".to_owned(),
                },
            ],
            ..Default::default()
        };

        assert_eq!(entrada.lyrics(), "primeira\nsegunda");
    }
}
