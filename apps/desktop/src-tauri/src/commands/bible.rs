//! Comandos da Biblia expostos a interface.

use tauri::State;

use crate::bible::{
    repository, BibleBook, BibleImportInput, BibleReferenceResult, BibleTranslation, BibleVerse,
    BibleVerseMatch,
};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn bible_list_translations(state: State<'_, AppState>) -> AppResult<Vec<BibleTranslation>> {
    repository::list_translations(&state.db)
}

#[tauri::command]
pub fn bible_import_translation(
    state: State<'_, AppState>,
    input: BibleImportInput,
) -> AppResult<BibleTranslation> {
    repository::import_translation(&state.db, input)
}

#[tauri::command]
pub fn bible_delete_translation(state: State<'_, AppState>, id: String) -> AppResult<()> {
    repository::delete_translation(&state.db, &id)
}

#[tauri::command]
pub fn bible_list_books(
    state: State<'_, AppState>,
    translation_id: String,
) -> AppResult<Vec<BibleBook>> {
    repository::list_books(&state.db, &translation_id)
}

#[tauri::command]
pub fn bible_get_chapter(
    state: State<'_, AppState>,
    book_id: String,
    chapter: i64,
) -> AppResult<Vec<BibleVerse>> {
    repository::get_chapter(&state.db, &book_id, chapter)
}

#[tauri::command]
pub fn bible_search(
    state: State<'_, AppState>,
    translation_id: String,
    query: String,
) -> AppResult<Vec<BibleVerseMatch>> {
    repository::search(&state.db, &translation_id, &query)
}

/// Resolve uma referencia digitada ("João 3:16") para preview -- antes de
/// apresentar. A apresentacao de verdade resolve a referencia de novo, do
/// zero, em vez de confiar no texto que a interface devolveria: quem decide
/// o que e' Escritura e' o banco, nunca um payload vindo da interface.
#[tauri::command]
pub fn bible_resolve_reference(
    state: State<'_, AppState>,
    translation_id: String,
    reference: String,
) -> AppResult<BibleReferenceResult> {
    repository::resolve_reference(&state.db, &translation_id, &reference)
}
