//! Persistencia da ordem do culto.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use uuid::Uuid;

use super::model::{Service, ServiceInput, ServiceItem, ServiceItemKind, ServiceSummary};
use crate::db::{now_millis, Database};
use crate::error::{AppError, AppResult};

fn new_id() -> String {
    Uuid::now_v7().to_string()
}

/// Cria um culto vazio.
pub fn create(db: &Database, input: ServiceInput) -> AppResult<Service> {
    let input = input.sanitized()?;
    let id = new_id();
    let now = now_millis();

    db.with_transaction(|tx| {
        tx.execute(
            "INSERT INTO services (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![id, input.title, now],
        )?;
        load(tx, &id)
    })
}

/// Renomeia o culto.
pub fn rename(db: &Database, id: &str, input: ServiceInput) -> AppResult<Service> {
    let input = input.sanitized()?;

    db.with_transaction(|tx| {
        let changed = tx.execute(
            "UPDATE services SET title = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, input.title, now_millis()],
        )?;
        if changed == 0 {
            return Err(AppError::not_found("Culto nao encontrado."));
        }
        load(tx, id)
    })
}

/// Exclui o culto. Os itens saem junto pelo ON DELETE CASCADE.
pub fn delete(db: &Database, id: &str) -> AppResult<()> {
    db.with_connection(|c| {
        let removed = c.execute("DELETE FROM services WHERE id = ?1", params![id])?;
        if removed == 0 {
            return Err(AppError::not_found("Culto nao encontrado."));
        }
        Ok(())
    })
}

pub fn get(db: &Database, id: &str) -> AppResult<Service> {
    db.with_connection(|c| load(c, id))
}

/// Lista os cultos salvos, do mais recente para o mais antigo.
pub fn list(db: &Database) -> AppResult<Vec<ServiceSummary>> {
    db.with_connection(|c| {
        let mut statement = c.prepare(
            "SELECT s.id, s.title, s.updated_at,
                    (SELECT count(*) FROM service_items WHERE service_id = s.id)
               FROM services s
              ORDER BY s.updated_at DESC, s.title COLLATE NOCASE",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(ServiceSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                updated_at: row.get(2)?,
                item_count: row.get(3)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
}

/// Acrescenta uma musica ao fim da ordem do culto.
///
/// O titulo e' copiado agora, na hora em que o item entra na lista -- se a
/// musica for renomeada depois, o item aqui continua legivel com o nome de
/// quando a ordem do culto foi montada.
pub fn add_song(db: &Database, service_id: &str, song_id: &str) -> AppResult<Service> {
    db.with_transaction(|tx| {
        ensure_service_exists(tx, service_id)?;

        let title: String = tx
            .query_row(
                "SELECT title FROM songs WHERE id = ?1",
                params![song_id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or_else(|| AppError::not_found("Musica nao encontrada."))?;

        let position = next_position(tx, service_id)?;
        tx.execute(
            "INSERT INTO service_items (id, service_id, position, kind, reference_id, title)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                new_id(),
                service_id,
                position,
                ServiceItemKind::Song.as_sql(),
                song_id,
                title
            ],
        )?;
        touch_service(tx, service_id)?;

        load(tx, service_id)
    })
}

/// Remove um item da ordem do culto e reempacota as posicoes dos que ficaram
/// depois -- sem isto sobraria um buraco na sequencia (posicoes 0, 1, 3, 4),
/// que nao afeta a correcao mas deixa o dado inconsistente para depurar.
pub fn remove_item(db: &Database, service_id: &str, item_id: &str) -> AppResult<Service> {
    db.with_transaction(|tx| {
        ensure_service_exists(tx, service_id)?;

        let removed = tx.execute(
            "DELETE FROM service_items WHERE id = ?1 AND service_id = ?2",
            params![item_id, service_id],
        )?;
        if removed == 0 {
            return Err(AppError::not_found(
                "Item nao encontrado na ordem do culto.",
            ));
        }

        repack_positions(tx, service_id)?;
        touch_service(tx, service_id)?;
        load(tx, service_id)
    })
}

/// Duplica um item, inserindo a copia logo depois do original.
///
/// E' o caso real de "cantar o mesmo louvor duas vezes" ou "repetir o slide de
/// oferta em dois momentos do culto" sem montar tudo de novo.
pub fn duplicate_item(db: &Database, service_id: &str, item_id: &str) -> AppResult<Service> {
    db.with_transaction(|tx| {
        ensure_service_exists(tx, service_id)?;

        let (position, kind, reference_id, title): (i64, String, Option<String>, String) = tx
            .query_row(
                "SELECT position, kind, reference_id, title FROM service_items
                  WHERE id = ?1 AND service_id = ?2",
                params![item_id, service_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::not_found("Item nao encontrado na ordem do culto."))?;

        // Abre espaco empurrando os itens seguintes uma posicao para frente,
        // depois insere a copia no vao aberto -- assim a copia fica logo
        // depois do original, e nao no fim da lista.
        //
        // O deslocamento passa pelo mesmo salto por zona negativa do
        // `move_item`, e pelo mesmo motivo: um UPDATE que incrementa um
        // intervalo inteiro de uma vez pode colidir com o `UNIQUE
        // (service_id, position)` a meio caminho, dependendo da ordem em que
        // o SQLite decide processar as linhas. Isto quebrou de verdade -- foi
        // pego rodando o aplicativo com tres itens, nao pelos testes, porque o
        // teste original so' tinha dois (uma unica linha deslocando nunca
        // colide com nada).
        let total = count_items(tx, service_id)?;
        let offset = total + 1;

        tx.execute(
            "UPDATE service_items SET position = position + 1 - ?3
              WHERE service_id = ?1 AND position > ?2",
            params![service_id, position, offset],
        )?;
        tx.execute(
            "UPDATE service_items SET position = position + ?2
              WHERE service_id = ?1 AND position < 0",
            params![service_id, offset],
        )?;
        tx.execute(
            "INSERT INTO service_items (id, service_id, position, kind, reference_id, title)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                new_id(),
                service_id,
                position + 1,
                kind,
                reference_id,
                title
            ],
        )?;

        touch_service(tx, service_id)?;
        load(tx, service_id)
    })
}

/// Move um item para uma nova posicao, empurrando os demais.
///
/// Indice fora da faixa e' recusado, nao truncado -- pelo mesmo motivo do
/// Presentation Engine: um clique errado (ou um arrasto que solta fora da
/// lista) nao pode jogar o item para o fim da ordem do culto.
pub fn move_item(
    db: &Database,
    service_id: &str,
    item_id: &str,
    new_position: i64,
) -> AppResult<Service> {
    db.with_transaction(|tx| {
        ensure_service_exists(tx, service_id)?;

        let total = count_items(tx, service_id)?;
        if new_position < 0 || new_position >= total {
            return Err(AppError::invalid("Posicao invalida na ordem do culto."));
        }

        let old_position: i64 = tx
            .query_row(
                "SELECT position FROM service_items WHERE id = ?1 AND service_id = ?2",
                params![item_id, service_id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or_else(|| AppError::not_found("Item nao encontrado na ordem do culto."))?;

        if old_position == new_position {
            return load(tx, service_id);
        }

        // O `UNIQUE (service_id, position)` e' verificado linha a linha
        // durante um UPDATE, nao so' ao final da instrucao -- deslocar um
        // intervalo inteiro numa unica instrucao pode colidir a meio caminho,
        // dependendo da ordem em que o SQLite decide processar as linhas (isto
        // quebrou de verdade num dos sentidos de movimento, e o teste que
        // pegou o bug ficou como `mover_para_tras_reordena_...`).
        //
        // A saida classica: afastar todo mundo envolvido para um intervalo de
        // posicoes que nunca colide com nada -- bem negativo, fora de
        // [0, total) -- e so' depois trazer cada linha para o lugar final. Os
        // dois saltos sao seguros em qualquer ordem de processamento, porque
        // nenhuma linha tocada jamais assume, mesmo que so' por um instante,
        // um valor que outra linha (tocada ou nao) ja ocupa.
        let offset = total;

        tx.execute(
            "UPDATE service_items SET position = ?2 - ?3 WHERE id = ?1",
            params![item_id, new_position, offset],
        )?;

        if old_position < new_position {
            tx.execute(
                "UPDATE service_items SET position = position - 1 - ?4
                  WHERE service_id = ?1 AND position > ?2 AND position <= ?3",
                params![service_id, old_position, new_position, offset],
            )?;
        } else {
            tx.execute(
                "UPDATE service_items SET position = position + 1 - ?4
                  WHERE service_id = ?1 AND position >= ?3 AND position < ?2",
                params![service_id, old_position, new_position, offset],
            )?;
        }

        tx.execute(
            "UPDATE service_items SET position = position + ?2
              WHERE service_id = ?1 AND position < 0",
            params![service_id, offset],
        )?;

        touch_service(tx, service_id)?;
        load(tx, service_id)
    })
}

// --- internos -------------------------------------------------------------

fn ensure_service_exists(tx: &Transaction<'_>, service_id: &str) -> AppResult<()> {
    let exists: bool = tx.query_row(
        "SELECT EXISTS (SELECT 1 FROM services WHERE id = ?1)",
        params![service_id],
        |row| row.get(0),
    )?;
    if !exists {
        return Err(AppError::not_found("Culto nao encontrado."));
    }
    Ok(())
}

fn touch_service(tx: &Transaction<'_>, service_id: &str) -> AppResult<()> {
    tx.execute(
        "UPDATE services SET updated_at = ?2 WHERE id = ?1",
        params![service_id, now_millis()],
    )?;
    Ok(())
}

fn next_position(tx: &Transaction<'_>, service_id: &str) -> AppResult<i64> {
    Ok(tx.query_row(
        "SELECT count(*) FROM service_items WHERE service_id = ?1",
        params![service_id],
        |row| row.get(0),
    )?)
}

fn count_items(tx: &Transaction<'_>, service_id: &str) -> AppResult<i64> {
    next_position(tx, service_id)
}

fn repack_positions(tx: &Transaction<'_>, service_id: &str) -> AppResult<()> {
    // SQLite nao tem "UPDATE ... FROM (SELECT row_number ...)" simples o
    // bastante para valer a pena aqui; a lista de um culto e' pequena (uma
    // ordem de culto real tem dezenas de itens, nao milhares), entao ler e
    // regravar em Rust e' claro e barato.
    let ids: Vec<String> = {
        let mut statement =
            tx.prepare("SELECT id FROM service_items WHERE service_id = ?1 ORDER BY position")?;
        let rows = statement.query_map(params![service_id], |row| row.get(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    for (position, id) in ids.into_iter().enumerate() {
        tx.execute(
            "UPDATE service_items SET position = ?2 WHERE id = ?1",
            params![id, position as i64],
        )?;
    }
    Ok(())
}

fn load(connection: &Connection, id: &str) -> AppResult<Service> {
    let service = connection
        .query_row(
            "SELECT id, title, created_at, updated_at FROM services WHERE id = ?1",
            params![id],
            |row| {
                Ok(Service {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    items: Vec::new(),
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::not_found("Culto nao encontrado."))?;

    let mut statement = connection.prepare(
        "SELECT id, position, kind, reference_id, title FROM service_items
          WHERE service_id = ?1 ORDER BY position",
    )?;
    let items = statement
        .query_map(params![id], |row| {
            let kind_raw: String = row.get(2)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                kind_raw,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(|(item_id, position, kind_raw, reference_id, title)| {
            Ok(ServiceItem {
                id: item_id,
                position,
                kind: ServiceItemKind::from_sql(&kind_raw)?,
                reference_id,
                title,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;

    Ok(Service { items, ..service })
}
