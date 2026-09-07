//! Persistencia das musicas.
//!
//! Todo o SQL do dominio vive aqui. Quem chama trabalha com structs; ninguem
//! fora deste arquivo escreve consulta de musica.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use uuid::Uuid;

use super::model::{Song, SongInput, SongSlide, SongSummary};
use super::{search, seed};
use crate::db::{now_millis, Database};
use crate::error::{AppError, AppResult};

/// Teto de resultados por busca.
///
/// Existe pelo orcamento de memoria: sem limite, uma busca por "a" numa
/// biblioteca de cinco mil musicas atravessaria o IPC inteira. O operador
/// tambem nao le mais do que isto -- ele refina a busca.
const SEARCH_LIMIT: usize = 100;

fn new_id() -> String {
    Uuid::now_v7().to_string()
}

/// Cria uma musica com seus slides e tags.
pub fn create(db: &Database, input: SongInput) -> AppResult<Song> {
    let input = input.sanitized()?;
    let id = new_id();
    let now = now_millis();

    db.with_transaction(|tx| {
        tx.execute(
            "INSERT INTO songs (id, title, artist, author, category, favorite, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![id, input.title, input.artist, input.author, input.category, input.favorite, now],
        )?;

        write_slides(tx, &id, &input)?;
        write_tags(tx, &id, &input.tags)?;
        reindex(tx, &id, &input)?;

        load(tx, &id)
    })
}

/// Substitui por completo os dados de uma musica existente.
pub fn update(db: &Database, id: &str, input: SongInput) -> AppResult<Song> {
    let input = input.sanitized()?;
    let now = now_millis();

    db.with_transaction(|tx| {
        let changed = tx.execute(
            "UPDATE songs
                SET title = ?2, artist = ?3, author = ?4, category = ?5,
                    favorite = ?6, updated_at = ?7
              WHERE id = ?1",
            params![
                id,
                input.title,
                input.artist,
                input.author,
                input.category,
                input.favorite,
                now
            ],
        )?;

        if changed == 0 {
            return Err(AppError::not_found("Musica nao encontrada."));
        }

        // Slides e tags sao reescritos do zero. Casar item a item seria mais
        // codigo para economizar escrita num volume que nao justifica.
        tx.execute("DELETE FROM song_slides WHERE song_id = ?1", params![id])?;
        tx.execute("DELETE FROM song_tags WHERE song_id = ?1", params![id])?;

        write_slides(tx, id, &input)?;
        write_tags(tx, id, &input.tags)?;
        reindex(tx, id, &input)?;

        load(tx, id)
    })
}

/// Exclui a musica. Slides, tags e historico saem junto pelo ON DELETE CASCADE.
pub fn delete(db: &Database, id: &str) -> AppResult<()> {
    db.with_transaction(|tx| {
        let removed = tx.execute("DELETE FROM songs WHERE id = ?1", params![id])?;
        if removed == 0 {
            return Err(AppError::not_found("Musica nao encontrada."));
        }
        // O indice de busca nao e' alcancado pelo cascade: e' tabela virtual.
        tx.execute("DELETE FROM songs_fts WHERE song_id = ?1", params![id])?;
        Ok(())
    })
}

/// Busca uma musica completa, com slides e tags.
pub fn get(db: &Database, id: &str) -> AppResult<Song> {
    db.with_connection(|connection| load(connection, id))
}

/// Liga ou desliga o favorito. Devolve o novo estado.
pub fn toggle_favorite(db: &Database, id: &str) -> AppResult<bool> {
    db.with_transaction(|tx| {
        let changed = tx.execute(
            "UPDATE songs SET favorite = NOT favorite, updated_at = ?2 WHERE id = ?1",
            params![id, now_millis()],
        )?;

        if changed == 0 {
            return Err(AppError::not_found("Musica nao encontrada."));
        }

        Ok(tx.query_row(
            "SELECT favorite FROM songs WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?)
    })
}

/// Registra que a musica foi usada. Alimenta "usadas recentemente".
pub fn register_usage(db: &Database, id: &str) -> AppResult<()> {
    db.with_transaction(|tx| {
        let exists: bool = tx.query_row(
            "SELECT EXISTS (SELECT 1 FROM songs WHERE id = ?1)",
            params![id],
            |row| row.get(0),
        )?;

        if !exists {
            return Err(AppError::not_found("Musica nao encontrada."));
        }

        tx.execute(
            "INSERT INTO song_usages (id, song_id, used_at) VALUES (?1, ?2, ?3)",
            params![new_id(), id, now_millis()],
        )?;
        Ok(())
    })
}

/// Insere as musicas de exemplo, e apenas se a biblioteca estiver vazia.
///
/// Devolve quantas foram inseridas -- zero quando ja havia musica. A guarda
/// existe para que um clique repetido no botao nao encha a biblioteca de
/// duplicatas.
pub fn seed_examples(db: &Database) -> AppResult<usize> {
    let is_empty: bool = db.with_connection(|connection| {
        Ok(
            connection.query_row("SELECT NOT EXISTS (SELECT 1 FROM songs)", [], |row| {
                row.get(0)
            })?,
        )
    })?;

    if !is_empty {
        return Ok(0);
    }

    let examples = seed::example_songs();
    let total = examples.len();
    for example in examples {
        create(db, example)?;
    }

    Ok(total)
}

/// Busca por titulo, artista, autor, letra ou tag.
///
/// Consulta vazia devolve a biblioteca ordenada pela edicao mais recente --
/// que e' o estado inicial util da tela, sem exigir um segundo comando.
pub fn search(db: &Database, query: &str) -> AppResult<Vec<SongSummary>> {
    db.with_connection(|connection| match search::build_match_query(query) {
        None => list_recent(connection),
        Some(expression) => search_indexed(connection, &expression),
    })
}

/// Musicas marcadas como favoritas, em ordem alfabetica.
pub fn list_favorites(db: &Database) -> AppResult<Vec<SongSummary>> {
    db.with_connection(|connection| {
        let mut statement = connection.prepare(
            "SELECT s.id, s.title, s.artist, s.favorite, s.updated_at,
                    (SELECT count(*) FROM song_slides WHERE song_id = s.id)
               FROM songs s
              WHERE s.favorite = 1
              ORDER BY s.title COLLATE NOCASE",
        )?;
        collect_summaries(&mut statement, [])
    })
}

/// Musicas usadas mais recentemente, sem repetir.
pub fn list_recently_used(db: &Database, limit: usize) -> AppResult<Vec<SongSummary>> {
    db.with_connection(|connection| {
        let mut statement = connection.prepare(
            "SELECT s.id, s.title, s.artist, s.favorite, s.updated_at,
                    (SELECT count(*) FROM song_slides WHERE song_id = s.id)
               FROM songs s
               JOIN (SELECT song_id, max(used_at) AS last_used
                       FROM song_usages
                      GROUP BY song_id) u ON u.song_id = s.id
              ORDER BY u.last_used DESC
              LIMIT ?1",
        )?;
        collect_summaries(&mut statement, params![limit as i64])
    })
}

// --- internos -------------------------------------------------------------

fn search_indexed(connection: &Connection, expression: &str) -> AppResult<Vec<SongSummary>> {
    // Os pesos do bm25 seguem a intencao do operador: quem digita "aleluia"
    // quase sempre procura a musica chamada "Aleluia", nao toda musica que
    // tenha "aleluia" no refrao. Titulo pesa mais; a letra ainda encontra.
    // (No bm25 do SQLite, peso maior = mais relevante; a ordenacao e' crescente
    // porque o escore vem negativo.)
    let mut statement = connection.prepare(
        "SELECT s.id, s.title, s.artist, s.favorite, s.updated_at,
                (SELECT count(*) FROM song_slides WHERE song_id = s.id)
           FROM songs_fts f
           JOIN songs s ON s.id = f.song_id
          WHERE songs_fts MATCH ?1
          ORDER BY bm25(songs_fts, 0.0, 10.0, 5.0, 3.0, 1.0, 2.0), s.title COLLATE NOCASE
          LIMIT ?2",
    )?;
    collect_summaries(&mut statement, params![expression, SEARCH_LIMIT as i64])
}

fn list_recent(connection: &Connection) -> AppResult<Vec<SongSummary>> {
    let mut statement = connection.prepare(
        "SELECT s.id, s.title, s.artist, s.favorite, s.updated_at,
                (SELECT count(*) FROM song_slides WHERE song_id = s.id)
           FROM songs s
          -- O desempate por titulo nao e' cosmetico: musicas cadastradas ou
          -- importadas no mesmo milissegundo empatam em `updated_at`, e sem
          -- criterio secundario o SQLite devolve ordem arbitraria -- a lista
          -- do operador se reembaralha entre uma abertura e outra.
          ORDER BY s.updated_at DESC, s.title COLLATE NOCASE
          LIMIT ?1",
    )?;
    collect_summaries(&mut statement, params![SEARCH_LIMIT as i64])
}

fn collect_summaries(
    statement: &mut rusqlite::Statement<'_>,
    parameters: impl rusqlite::Params,
) -> AppResult<Vec<SongSummary>> {
    let rows = statement.query_map(parameters, |row| {
        Ok(SongSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            artist: row.get(2)?,
            favorite: row.get(3)?,
            updated_at: row.get(4)?,
            slide_count: row.get(5)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn write_slides(tx: &Transaction<'_>, song_id: &str, input: &SongInput) -> AppResult<()> {
    let mut statement = tx.prepare(
        "INSERT INTO song_slides (id, song_id, position, label, content)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;

    for (position, slide) in input.slides.iter().enumerate() {
        statement.execute(params![
            new_id(),
            song_id,
            position as i64,
            slide.label,
            slide.content
        ])?;
    }

    Ok(())
}

fn write_tags(tx: &Transaction<'_>, song_id: &str, tags: &[String]) -> AppResult<()> {
    for tag in tags {
        // `name` e' UNIQUE COLLATE NOCASE, entao "Natal" e "natal" convergem
        // para a mesma linha em vez de duplicar a tag na biblioteca.
        let existing: Option<String> = tx
            .query_row("SELECT id FROM tags WHERE name = ?1", params![tag], |row| {
                row.get(0)
            })
            .optional()?;

        let tag_id = match existing {
            Some(id) => id,
            None => {
                let id = new_id();
                tx.execute(
                    "INSERT INTO tags (id, name) VALUES (?1, ?2)",
                    params![id, tag],
                )?;
                id
            }
        };

        tx.execute(
            "INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?1, ?2)",
            params![song_id, tag_id],
        )?;
    }

    Ok(())
}

/// Reescreve a entrada da musica no indice de busca.
///
/// Chamado depois de toda escrita. Se algum caminho novo esquecer disto, a
/// musica existe mas nao aparece na busca -- e' o bug mais provavel deste
/// modulo, e por isso ha teste cobrindo criacao, edicao e exclusao.
fn reindex(tx: &Transaction<'_>, song_id: &str, input: &SongInput) -> AppResult<()> {
    tx.execute("DELETE FROM songs_fts WHERE song_id = ?1", params![song_id])?;
    tx.execute(
        "INSERT INTO songs_fts (song_id, title, artist, author, lyrics, tags)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            song_id,
            input.title,
            input.artist,
            input.author,
            input.lyrics(),
            input.tags.join(" ")
        ],
    )?;
    Ok(())
}

fn load(connection: &Connection, id: &str) -> AppResult<Song> {
    let song = connection
        .query_row(
            "SELECT id, title, artist, author, category, favorite, created_at, updated_at
               FROM songs WHERE id = ?1",
            params![id],
            |row| {
                Ok(Song {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    author: row.get(3)?,
                    category: row.get(4)?,
                    favorite: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                    tags: Vec::new(),
                    slides: Vec::new(),
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::not_found("Musica nao encontrada."))?;

    let mut slides_statement = connection.prepare(
        "SELECT id, position, label, content FROM song_slides
          WHERE song_id = ?1 ORDER BY position",
    )?;
    let slides = slides_statement
        .query_map(params![id], |row| {
            Ok(SongSlide {
                id: row.get(0)?,
                position: row.get(1)?,
                label: row.get(2)?,
                content: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut tags_statement = connection.prepare(
        "SELECT t.name FROM tags t
           JOIN song_tags st ON st.tag_id = t.id
          WHERE st.song_id = ?1
          ORDER BY t.name COLLATE NOCASE",
    )?;
    let tags = tags_statement
        .query_map(params![id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Song {
        slides,
        tags,
        ..song
    })
}
