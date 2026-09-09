//! Comandos de apresentacao expostos a interface.
//!
//! Camada fina: traduz IPC para chamadas do motor e avisa as janelas quando
//! algo muda. Toda a regra vive em `presentation::engine`, onde da' para testar
//! sem subir uma tela.
//!
//! Aqui tambem mora a **traducao de dominio para slides** -- transformar uma
//! musica em uma sequencia projetavel. Ela fica neste ponto de proposito: o
//! motor nao pode conhecer musica (senao acrescentar Biblia ou video exigiria
//! mexer nele), e o dominio de musicas nao pode conhecer projecao. Quem une os
//! dois e' a camada de composicao, que e' esta.

use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use crate::bible::{repository as bible_repository, BibleReferenceResult};
use crate::error::{AppError, AppResult};
use crate::presentation::{Presentation, PresentationSlide, PresentationState};
use crate::songs::{repository, Song};
use crate::state::AppState;

/// Evento emitido a cada mudanca. A segunda tela e o Control Room escutam.
const STATE_EVENT: &str = "presentation:state";

/// Converte uma musica em sequencia projetavel.
fn from_song(song: &Song) -> Presentation {
    Presentation {
        source_id: song.id.clone(),
        title: song.title.clone(),
        slides: song
            .slides
            .iter()
            .map(|slide| PresentationSlide::new(&slide.label, &slide.content))
            .collect(),
    }
}

/// Converte um resultado de referencia biblica em sequencia projetavel: um
/// slide por versiculo, para que o operador possa avancar versiculo a
/// versiculo com os mesmos comandos de navegacao das musicas.
fn from_bible_reference(result: &BibleReferenceResult) -> Presentation {
    Presentation {
        source_id: format!(
            "bible:{}:{}:{}",
            result.book.id,
            result.chapter,
            result.verses.first().map_or(0, |verse| verse.verse)
        ),
        title: format!("{} {}", result.book.name, result.chapter),
        slides: result
            .verses
            .iter()
            .map(|verse| {
                PresentationSlide::new(
                    format!(
                        "{} {}:{}",
                        result.book.abbreviation, result.chapter, verse.verse
                    ),
                    &verse.text,
                )
            })
            .collect(),
    }
}

/// Um texto avulso ("aviso", "oracao") digitado direto pelo operador -- sem
/// passar pela biblioteca de musicas. Cada bloco separado por linha em
/// branco vira um slide, na mesma convencao ja usada no editor de letras
/// (`parseLyrics`, do lado da interface) -- ver `docs/background.md`.
///
/// Nao existe persistencia aqui de proposito: e' o analogo de um bilhete
/// escrito na hora, nao uma musica que devesse entrar na biblioteca.
fn from_text(blocks: Vec<PresentationSlide>) -> Presentation {
    Presentation {
        source_id: format!("text:{}", Uuid::now_v7()),
        title: "Texto".to_owned(),
        // O `kind` que chega aqui vem sempre `Text` (a interface nao monta QR
        // Code por este caminho), mas normalizar explicitamente evita que um
        // valor inesperado no JSON vire QR Code por acidente.
        slides: blocks
            .into_iter()
            .map(|block| PresentationSlide::new(block.label, block.content))
            .collect(),
    }
}

/// Um unico slide de QR Code. `payload` e' o que o codigo carrega -- uma URL,
/// um texto de PIX -- nunca o desenho: quem sabe transformar isso em imagem
/// e' a tela de projecao, nao o nucleo.
fn from_qr(title: &str, payload: &str) -> Presentation {
    Presentation {
        source_id: format!("qr:{}", Uuid::now_v7()),
        title: title.to_owned(),
        slides: vec![PresentationSlide::new_qr(title, payload)],
    }
}

/// Publica o estado para todas as janelas.
///
/// So' e' chamado quando algo mudou de fato -- os metodos do motor devolvem
/// `false` quando a operacao nao alterou nada. Evita acordar a janela de
/// projecao a toa, que e' desperdicio num PC fraco.
fn broadcast(app: &AppHandle, state: PresentationState) -> AppResult<PresentationState> {
    // Falhar ao emitir nao pode derrubar o comando: a projecao em andamento
    // continua correta, e o proximo evento realinha as janelas.
    let _ = app.emit(STATE_EVENT, &state);
    Ok(state)
}

/// Coloca uma musica no ar, a partir do primeiro slide.
#[tauri::command]
pub fn presentation_present_song(
    app: AppHandle,
    state: State<'_, AppState>,
    song_id: String,
) -> AppResult<PresentationState> {
    let song = repository::get(&state.db, &song_id)?;
    // O historico e' alimentado aqui, e nao ao abrir a musica na biblioteca:
    // "usadas recentemente" significa usadas no culto, nao espiadas na lista.
    repository::register_usage(&state.db, &song_id)?;

    let presentation = from_song(&song);
    let novo = state.with_presentation(|engine| {
        engine.load(presentation);
        engine.state()
    });

    broadcast(&app, novo)
}

/// Coloca uma referencia biblica no ar ("João 3:16", "Salmos 23").
///
/// Resolve a referencia do zero a partir do banco, em vez de aceitar o texto
/// do versiculo vindo da interface: quem decide o que e' Escritura e' o
/// banco, nunca um payload que a interface poderia ter alterado.
#[tauri::command]
pub fn presentation_present_bible(
    app: AppHandle,
    state: State<'_, AppState>,
    translation_id: String,
    reference: String,
) -> AppResult<PresentationState> {
    let result = bible_repository::resolve_reference(&state.db, &translation_id, &reference)?;
    let presentation = from_bible_reference(&result);

    let novo = state.with_presentation(|engine| {
        engine.load(presentation);
        engine.state()
    });

    broadcast(&app, novo)
}

/// Coloca um texto avulso no ar -- um aviso, uma oracao -- sem passar pela
/// biblioteca de musicas. `slides` ja vem dividido em blocos: a interface usa
/// a mesma regra do editor de letras (linha em branco separa bloco).
#[tauri::command]
pub fn presentation_present_text(
    app: AppHandle,
    state: State<'_, AppState>,
    slides: Vec<PresentationSlide>,
) -> AppResult<PresentationState> {
    if slides.is_empty() {
        return Err(AppError::invalid("Digite algum texto antes de apresentar."));
    }

    let presentation = from_text(slides);
    let novo = state.with_presentation(|engine| {
        engine.load(presentation);
        engine.state()
    });

    broadcast(&app, novo)
}

/// Coloca um QR Code no ar -- tipicamente uma chave PIX para a oferta.
/// `payload` e' o que o codigo carrega; o desenho e' feito pela tela, nunca
/// aqui.
#[tauri::command]
pub fn presentation_present_qr(
    app: AppHandle,
    state: State<'_, AppState>,
    title: String,
    payload: String,
) -> AppResult<PresentationState> {
    if payload.trim().is_empty() {
        return Err(AppError::invalid("Digite o conteudo do QR Code."));
    }

    let title = if title.trim().is_empty() {
        "QR Code".to_owned()
    } else {
        title
    };
    let presentation = from_qr(&title, payload.trim());
    let novo = state.with_presentation(|engine| {
        engine.load(presentation);
        engine.state()
    });

    broadcast(&app, novo)
}

#[tauri::command]
pub fn presentation_state(state: State<'_, AppState>) -> PresentationState {
    state.with_presentation(|engine| engine.state())
}

#[tauri::command]
pub fn presentation_next(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.next();
        engine.state()
    });
    broadcast(&app, novo)
}

#[tauri::command]
pub fn presentation_previous(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.previous();
        engine.state()
    });
    broadcast(&app, novo)
}

#[tauri::command]
pub fn presentation_first(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.first();
        engine.state()
    });
    broadcast(&app, novo)
}

#[tauri::command]
pub fn presentation_last(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.last();
        engine.state()
    });
    broadcast(&app, novo)
}

#[tauri::command]
pub fn presentation_go_to(
    app: AppHandle,
    state: State<'_, AppState>,
    index: usize,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.go_to(index);
        engine.state()
    });
    broadcast(&app, novo)
}

#[tauri::command]
pub fn presentation_toggle_blackout(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.toggle_blackout();
        engine.state()
    });
    broadcast(&app, novo)
}

/// Tira tudo do ar e volta a tela de espera.
#[tauri::command]
pub fn presentation_clear(
    app: AppHandle,
    state: State<'_, AppState>,
) -> AppResult<PresentationState> {
    let novo = state.with_presentation(|engine| {
        engine.clear();
        engine.state()
    });
    broadcast(&app, novo)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::presentation::model::SlideKind;
    use crate::songs::model::SlideInput;
    use crate::songs::SongInput;

    #[test]
    fn a_conversao_preserva_a_ordem_e_os_rotulos() {
        let db = crate::db::Database::open_in_memory().expect("banco");
        let song = repository::create(
            &db,
            SongInput {
                title: "Grande e o Senhor".to_owned(),
                slides: vec![
                    SlideInput {
                        label: "Verso 1".to_owned(),
                        content: "Primeira".to_owned(),
                    },
                    SlideInput {
                        label: "Refrao".to_owned(),
                        content: "Aleluia".to_owned(),
                    },
                ],
                ..Default::default()
            },
        )
        .expect("deveria criar");

        let presentation = from_song(&song);

        assert_eq!(presentation.source_id, song.id);
        assert_eq!(presentation.title, "Grande e o Senhor");
        assert_eq!(presentation.slides.len(), 2);
        assert_eq!(presentation.slides[0].label, "Verso 1");
        assert_eq!(presentation.slides[1].content, "Aleluia");
    }

    #[test]
    fn musica_sem_slides_vira_apresentacao_vazia_em_vez_de_erro() {
        let db = crate::db::Database::open_in_memory().expect("banco");
        let song = repository::create(
            &db,
            SongInput {
                title: "Sem letra".to_owned(),
                ..Default::default()
            },
        )
        .expect("deveria criar");

        // Uma musica ainda sem letra cadastrada nao pode derrubar a projecao.
        assert!(from_song(&song).slides.is_empty());
    }

    #[test]
    fn texto_avulso_vira_um_slide_por_bloco() {
        let presentation = from_text(vec![
            PresentationSlide::new("", "Bem-vindos ao culto"),
            PresentationSlide::new("", "A oferta comeca em 5 minutos"),
        ]);

        assert_eq!(presentation.slides.len(), 2);
        assert_eq!(
            presentation.slides[1].content,
            "A oferta comeca em 5 minutos"
        );
        assert!(presentation.source_id.starts_with("text:"));
    }

    #[test]
    fn texto_avulso_nunca_vira_slide_de_qr_mesmo_que_o_json_diga_isso() {
        // O `kind` que chegaria de um JSON malicioso/malformado e' ignorado:
        // este caminho so' produz texto.
        let presentation = from_text(vec![PresentationSlide::new_qr("", "nao deveria ser qr")]);

        assert_eq!(presentation.slides[0].kind, SlideKind::Text);
    }

    #[test]
    fn qr_code_guarda_o_payload_sem_alterar() {
        let presentation = from_qr("PIX da oferta", "00020126580014BR.GOV.BCB.PIX");

        assert_eq!(presentation.title, "PIX da oferta");
        assert_eq!(presentation.slides.len(), 1);
        assert_eq!(presentation.slides[0].kind, SlideKind::Qr);
        assert_eq!(
            presentation.slides[0].content,
            "00020126580014BR.GOV.BCB.PIX"
        );
    }
}
