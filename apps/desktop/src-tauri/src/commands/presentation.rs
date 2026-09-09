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

use crate::bible::{repository as bible_repository, BibleReferenceResult};
use crate::error::AppResult;
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
            .map(|slide| PresentationSlide {
                label: slide.label.clone(),
                content: slide.content.clone(),
            })
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
            .map(|verse| PresentationSlide {
                label: format!(
                    "{} {}:{}",
                    result.book.abbreviation, result.chapter, verse.verse
                ),
                content: verse.text.clone(),
            })
            .collect(),
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
}
