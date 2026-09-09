//! Persistencia da Biblia.

use rusqlite::{params, Connection, ErrorCode};
use uuid::Uuid;

use super::model::{
    BibleBook, BibleImportInput, BibleReferenceResult, BibleTranslation, BibleVerse,
    BibleVerseMatch,
};
use super::reference::parse_reference;
use crate::db::{now_millis, Database};
use crate::error::{AppError, AppResult};
use crate::fts::build_match_query;

/// Teto de resultados por busca, pelo mesmo motivo do teto em `songs`: sem
/// limite, uma busca por uma palavra comum devolveria centenas de
/// versiculos pelo IPC de uma vez.
const SEARCH_LIMIT: usize = 100;

fn new_id() -> String {
    Uuid::now_v7().to_string()
}

/// `true` quando o erro e' uma violacao de UNIQUE -- usado para trocar
/// "Nao foi possivel acessar a biblioteca local." por uma mensagem que diz
/// exatamente o que aconteceu (sigla de traducao repetida).
fn is_unique_violation(error: &rusqlite::Error) -> bool {
    matches!(
        error,
        rusqlite::Error::SqliteFailure(sqlite_error, _)
            if sqlite_error.code == ErrorCode::ConstraintViolation
    )
}

/// Casa-fold para comparar nome de livro sem depender de acento ou caixa.
/// So' as letras portuguesas relevantes -- nao e' um fold Unicode geral,
/// mas cobre o alfabeto que qualquer traducao em portugues usa.
fn fold(text: &str) -> String {
    text.chars()
        .map(|character| {
            let lower = character.to_lowercase().next().unwrap_or(character);
            match lower {
                'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
                'é' | 'è' | 'ê' | 'ë' => 'e',
                'í' | 'ì' | 'î' | 'ï' => 'i',
                'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
                'ú' | 'ù' | 'û' | 'ü' => 'u',
                'ç' => 'c',
                other => other,
            }
        })
        .collect()
}

/// Importa uma traducao inteira: metadados, livros e versiculos.
///
/// E' o **unico** jeito de colocar texto biblico no aplicativo -- nao ha
/// traducao embutida no instalador (ver `docs/bible.md`).
pub fn import_translation(db: &Database, input: BibleImportInput) -> AppResult<BibleTranslation> {
    let input = input.validated()?;
    let translation_id = new_id();
    let now = now_millis();
    let abbreviation = input.abbreviation.trim();

    db.with_transaction(|tx| {
        tx.execute(
            "INSERT INTO bible_translations (id, abbreviation, name, language, imported_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![translation_id, abbreviation, input.name.trim(), input.language.trim(), now],
        )
        .map_err(|error| {
            if is_unique_violation(&error) {
                AppError::invalid(format!(
                    "Ja existe uma traducao importada com a sigla \"{abbreviation}\"."
                ))
            } else {
                AppError::from(error)
            }
        })?;

        for (position, book) in input.books.iter().enumerate() {
            let book_id = new_id();
            tx.execute(
                "INSERT INTO bible_books (id, translation_id, position, name, abbreviation, chapter_count)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    book_id,
                    translation_id,
                    position as i64,
                    book.name.trim(),
                    book.abbreviation.trim(),
                    book.chapters.len() as i64
                ],
            )?;

            for (chapter_index, verses) in book.chapters.iter().enumerate() {
                let chapter_number = (chapter_index + 1) as i64;
                for (verse_index, text) in verses.iter().enumerate() {
                    let verse_number = (verse_index + 1) as i64;
                    let verse_id = new_id();
                    let text = text.trim();

                    tx.execute(
                        "INSERT INTO bible_verses (id, book_id, chapter, verse, text)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![verse_id, book_id, chapter_number, verse_number, text],
                    )?;
                    tx.execute(
                        "INSERT INTO bible_verses_fts (verse_id, text) VALUES (?1, ?2)",
                        params![verse_id, text],
                    )?;
                }
            }
        }

        Ok(tx.query_row(
            "SELECT id, abbreviation, name, language, imported_at
               FROM bible_translations WHERE id = ?1",
            params![translation_id],
            row_to_translation,
        )?)
    })
}

/// Remove a traducao. Livros e versiculos saem pelo ON DELETE CASCADE; o
/// indice de busca precisa ser limpo a mao, por ser tabela virtual.
pub fn delete_translation(db: &Database, id: &str) -> AppResult<()> {
    db.with_transaction(|tx| {
        let exists: bool = tx.query_row(
            "SELECT EXISTS (SELECT 1 FROM bible_translations WHERE id = ?1)",
            params![id],
            |row| row.get(0),
        )?;
        if !exists {
            return Err(AppError::not_found("Traducao nao encontrada."));
        }

        tx.execute(
            "DELETE FROM bible_verses_fts WHERE verse_id IN (
                SELECT v.id FROM bible_verses v
                JOIN bible_books b ON b.id = v.book_id
                WHERE b.translation_id = ?1
             )",
            params![id],
        )?;
        tx.execute("DELETE FROM bible_translations WHERE id = ?1", params![id])?;
        Ok(())
    })
}

pub fn list_translations(db: &Database) -> AppResult<Vec<BibleTranslation>> {
    db.with_connection(|connection| {
        let mut statement = connection.prepare(
            "SELECT id, abbreviation, name, language, imported_at
               FROM bible_translations ORDER BY name COLLATE NOCASE",
        )?;
        let rows = statement.query_map([], row_to_translation)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
}

pub fn list_books(db: &Database, translation_id: &str) -> AppResult<Vec<BibleBook>> {
    db.with_connection(|connection| query_books(connection, translation_id))
}

pub fn get_chapter(db: &Database, book_id: &str, chapter: i64) -> AppResult<Vec<BibleVerse>> {
    db.with_connection(|connection| {
        let mut statement = connection.prepare(
            "SELECT id, book_id, chapter, verse, text FROM bible_verses
              WHERE book_id = ?1 AND chapter = ?2 ORDER BY verse",
        )?;
        let rows = statement.query_map(params![book_id, chapter], row_to_verse)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
}

/// Busca por palavra, restrita a uma traducao.
///
/// Ao contrario da busca de musicas, texto vazio devolve lista vazia, nao a
/// "biblioteca recente" -- nao existe um equivalente natural de "capitulo
/// usado recentemente", e devolver a Biblia inteira por engano seria caro.
pub fn search(db: &Database, translation_id: &str, query: &str) -> AppResult<Vec<BibleVerseMatch>> {
    db.with_connection(|connection| {
        let Some(expression) = build_match_query(query) else {
            return Ok(Vec::new());
        };

        let mut statement = connection.prepare(
            "SELECT v.id, v.book_id, v.chapter, v.verse, v.text, b.name, b.abbreviation
               FROM bible_verses_fts f
               JOIN bible_verses v ON v.id = f.verse_id
               JOIN bible_books b ON b.id = v.book_id
              WHERE bible_verses_fts MATCH ?1 AND b.translation_id = ?2
              ORDER BY b.position, v.chapter, v.verse
              LIMIT ?3",
        )?;
        let rows = statement.query_map(
            params![expression, translation_id, SEARCH_LIMIT as i64],
            |row| {
                Ok(BibleVerseMatch {
                    verse: row_to_verse(row)?,
                    book_name: row.get(5)?,
                    book_abbreviation: row.get(6)?,
                })
            },
        )?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
}

/// Resolve uma referencia digitada ("João 3:16", "Salmos 23") contra uma
/// traducao especifica.
pub fn resolve_reference(
    db: &Database,
    translation_id: &str,
    reference_text: &str,
) -> AppResult<BibleReferenceResult> {
    let parsed = parse_reference(reference_text).ok_or_else(|| {
        AppError::invalid("Nao entendi essa referencia. Use o formato \"Joao 3:16\".")
    })?;

    db.with_connection(|connection| {
        let books = query_books(connection, translation_id)?;
        let book = resolve_book(&books, &parsed.book_query).ok_or_else(|| {
            AppError::not_found(format!("Livro \"{}\" nao encontrado.", parsed.book_query))
        })?;

        if parsed.chapter > book.chapter_count {
            return Err(AppError::invalid(format!(
                "\"{}\" tem {} capitulos; o capitulo {} nao existe.",
                book.name, book.chapter_count, parsed.chapter
            )));
        }

        // Um so' versiculo e' tratado como a faixa [inicio, inicio]; nenhum
        // versiculo informado ("Salmos 23") vira [NULL, NULL], que a
        // condicao abaixo interpreta como "o capitulo inteiro".
        let verse_end = parsed.verse_end.or(parsed.verse_start);

        let mut statement = connection.prepare(
            "SELECT id, book_id, chapter, verse, text FROM bible_verses
              WHERE book_id = ?1 AND chapter = ?2
                AND (?3 IS NULL OR verse >= ?3)
                AND (?4 IS NULL OR verse <= ?4)
              ORDER BY verse",
        )?;
        let verses = statement
            .query_map(
                params![book.id, parsed.chapter, parsed.verse_start, verse_end],
                row_to_verse,
            )?
            .collect::<Result<Vec<_>, _>>()?;

        if verses.is_empty() {
            return Err(AppError::not_found(
                "Nenhum versiculo encontrado para essa referencia.",
            ));
        }

        Ok(BibleReferenceResult {
            book,
            chapter: parsed.chapter,
            verses,
        })
    })
}

// --- internos ---------------------------------------------------------

fn query_books(connection: &Connection, translation_id: &str) -> AppResult<Vec<BibleBook>> {
    let mut statement = connection.prepare(
        "SELECT id, translation_id, position, name, abbreviation, chapter_count
           FROM bible_books WHERE translation_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map(params![translation_id], |row| {
        Ok(BibleBook {
            id: row.get(0)?,
            translation_id: row.get(1)?,
            position: row.get(2)?,
            name: row.get(3)?,
            abbreviation: row.get(4)?,
            chapter_count: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Casa o texto digitado contra os livros da traducao, em ordem de
/// especificidade: sigla exata, nome exato, depois prefixo do nome e da
/// sigla. Os livros chegam ordenados por posicao canonica, entao um empate
/// de prefixo (por exemplo "Jo" batendo com varios livros) sempre resolve
/// para o primeiro livro na ordem da Biblia, nao numa ordem arbitraria.
fn resolve_book(books: &[BibleBook], query: &str) -> Option<BibleBook> {
    let folded_query = fold(query);

    books
        .iter()
        .find(|book| fold(&book.abbreviation) == folded_query)
        .or_else(|| books.iter().find(|book| fold(&book.name) == folded_query))
        .or_else(|| {
            books
                .iter()
                .find(|book| fold(&book.name).starts_with(&folded_query))
        })
        .or_else(|| {
            books
                .iter()
                .find(|book| fold(&book.abbreviation).starts_with(&folded_query))
        })
        .cloned()
}

fn row_to_translation(row: &rusqlite::Row<'_>) -> rusqlite::Result<BibleTranslation> {
    Ok(BibleTranslation {
        id: row.get(0)?,
        abbreviation: row.get(1)?,
        name: row.get(2)?,
        language: row.get(3)?,
        imported_at: row.get(4)?,
    })
}

fn row_to_verse(row: &rusqlite::Row<'_>) -> rusqlite::Result<BibleVerse> {
    Ok(BibleVerse {
        id: row.get(0)?,
        book_id: row.get(1)?,
        chapter: row.get(2)?,
        verse: row.get(3)?,
        text: row.get(4)?,
    })
}
