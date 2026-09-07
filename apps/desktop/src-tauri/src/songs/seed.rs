//! Musicas de exemplo para a primeira execucao.
//!
//! Duas decisoes aqui.
//!
//! **O conteudo e' original e generico**, escrito para este arquivo. Letras de
//! hinos conhecidos levantariam duvida de direito autoral -- traducoes tem
//! copyright proprio mesmo quando o hino original ja caiu em dominio publico --
//! e o projeto nao distribui conteudo protegido (ver README).
//!
//! **O seed nao roda sozinho.** Um app que se enche de musicas falsas na
//! primeira abertura obriga o operador a limpar a biblioteca antes de usar. Em
//! vez disso, a tela vazia oferece o botao, e ele decide. Por seguranca, o
//! comando tambem se recusa a inserir se a biblioteca ja tiver qualquer musica.

use super::model::{SlideInput, SongInput};

fn slide(label: &str, content: &str) -> SlideInput {
    SlideInput {
        label: label.to_owned(),
        content: content.to_owned(),
    }
}

/// Musicas de demonstracao, cobrindo os casos que o operador vai encontrar:
/// com e sem marcacao de bloco, com e sem artista, com tags e acentuacao.
pub fn example_songs() -> Vec<SongInput> {
    vec![
        SongInput {
            title: "Exemplo: Canção de Entrada".to_owned(),
            artist: "Equipe Holy Media".to_owned(),
            author: "Conteúdo de demonstração".to_owned(),
            category: "Entrada".to_owned(),
            favorite: true,
            tags: vec!["exemplo".to_owned(), "abertura".to_owned()],
            slides: vec![
                slide(
                    "Verso 1",
                    "Esta é uma música de exemplo\npara você conhecer o programa",
                ),
                slide(
                    "Refrão",
                    "Cante, celebre, agradeça\nem cada manhã que começa",
                ),
                slide(
                    "Verso 2",
                    "Troque esta letra pela sua\nou cadastre uma música nova",
                ),
                slide(
                    "Refrão",
                    "Cante, celebre, agradeça\nem cada manhã que começa",
                ),
            ],
        },
        SongInput {
            title: "Exemplo: Coração Agradecido".to_owned(),
            artist: String::new(),
            author: "Conteúdo de demonstração".to_owned(),
            category: "Adoração".to_owned(),
            favorite: false,
            // Titulo com acento de proposito: da' para conferir que buscar
            // "coracao", sem acento, encontra esta musica.
            tags: vec!["exemplo".to_owned(), "gratidão".to_owned()],
            slides: vec![
                slide("", "Um coração agradecido\nreconhece o que recebeu"),
                slide("", "E devolve em forma de canto\ntudo aquilo que viveu"),
            ],
        },
        SongInput {
            title: "Exemplo: Slide de Encerramento".to_owned(),
            artist: String::new(),
            author: "Conteúdo de demonstração".to_owned(),
            category: "Encerramento".to_owned(),
            favorite: false,
            tags: vec!["exemplo".to_owned()],
            slides: vec![slide("", "Obrigado por participar\nAté a próxima")],
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn os_exemplos_passam_na_validacao_do_dominio() {
        for exemplo in example_songs() {
            let titulo = exemplo.title.clone();
            exemplo
                .sanitized()
                .unwrap_or_else(|erro| panic!("exemplo {titulo:?} invalido: {erro}"));
        }
    }

    #[test]
    fn todo_exemplo_tem_slide() {
        for exemplo in example_songs() {
            assert!(
                !exemplo.slides.is_empty(),
                "exemplo {:?} sem slides",
                exemplo.title
            );
        }
    }

    #[test]
    fn os_exemplos_sao_identificaveis_como_exemplo() {
        // O operador precisa saber, olhando a lista, o que pode apagar.
        for exemplo in example_songs() {
            assert!(
                exemplo.title.starts_with("Exemplo:"),
                "exemplo {:?} nao se identifica como tal",
                exemplo.title
            );
        }
    }
}
