//! Acesso ao banco local.
//!
//! Uma unica conexao SQLite protegida por mutex. Um app de projecao tem um
//! operador e um punhado de consultas por minuto -- pool de conexoes aqui seria
//! complexidade sem beneficio, e cada conexao extra custa memoria no PC fraco
//! que e' o alvo do produto.

pub mod migrations;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::AppResult;

/// Banco local da aplicacao.
pub struct Database {
    connection: Mutex<Connection>,
}

impl Database {
    /// Abre (ou cria) o banco em disco e aplica as migrations pendentes.
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let connection = Connection::open(path)?;
        Self::prepare(connection)
    }

    /// Banco em memoria. Usado pelos testes -- cada teste com o seu, isolado.
    #[cfg(test)]
    pub fn open_in_memory() -> AppResult<Self> {
        let connection = Connection::open_in_memory()?;
        Self::prepare(connection)
    }

    fn prepare(connection: Connection) -> AppResult<Self> {
        // WAL: leitura nao bloqueia escrita. Durante o culto o operador busca
        // musica enquanto o app grava historico -- um nao pode travar o outro.
        //
        // `synchronous = NORMAL` e' o par recomendado do WAL: sobrevive a queda
        // do aplicativo, e so um corte de energia na tomada poderia custar a
        // ultima transacao. Para uma biblioteca de musicas o risco vale a
        // escrita muito mais rapida em HD mecanico.
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "NORMAL")?;
        // Sem isto o SQLite ignora ON DELETE CASCADE em silencio, e apagar uma
        // musica deixaria slides orfaos para sempre.
        connection.pragma_update(None, "foreign_keys", true)?;

        migrations::run(&connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    /// Executa `operation` com a conexao travada.
    ///
    /// Um mutex envenenado significa que alguma outra operacao entrou em panico
    /// segurando a trava. O dado em disco continua integro (a transacao teria
    /// sofrido rollback), entao seguimos com a conexao em vez de derrubar o app
    /// no meio de um culto.
    pub fn with_connection<T>(
        &self,
        operation: impl FnOnce(&Connection) -> AppResult<T>,
    ) -> AppResult<T> {
        let guard = self
            .connection
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        operation(&guard)
    }

    /// Igual a `with_connection`, mas dentro de uma transacao: ou tudo grava,
    /// ou nada grava.
    pub fn with_transaction<T>(
        &self,
        operation: impl FnOnce(&rusqlite::Transaction<'_>) -> AppResult<T>,
    ) -> AppResult<T> {
        let mut guard = self
            .connection
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let transaction = guard.transaction()?;
        let value = operation(&transaction)?;
        transaction.commit()?;
        Ok(value)
    }
}

/// Milissegundos desde a epoca. Formato unico de data no projeto: sem
/// dependencia de biblioteca, e `new Date(ms)` do lado TypeScript.
pub fn now_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn banco_novo_ja_vem_migrado() {
        let db = Database::open_in_memory().expect("banco deve abrir");

        let tables: i64 = db
            .with_connection(|c| {
                Ok(c.query_row(
                    "SELECT count(*) FROM sqlite_master
                      WHERE type = 'table' AND name IN ('songs', 'song_slides', 'tags')",
                    [],
                    |row| row.get(0),
                )?)
            })
            .expect("consulta deve funcionar");

        assert_eq!(tables, 3);
    }

    #[test]
    fn chaves_estrangeiras_estao_ligadas() {
        let db = Database::open_in_memory().expect("banco deve abrir");

        let enabled: bool = db
            .with_connection(|c| Ok(c.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?))
            .expect("pragma deve responder");

        assert!(enabled, "sem isto o ON DELETE CASCADE nao funciona");
    }

    #[test]
    fn transacao_desfaz_tudo_quando_a_operacao_falha() {
        let db = Database::open_in_memory().expect("banco deve abrir");

        let result: AppResult<()> = db.with_transaction(|tx| {
            tx.execute(
                "INSERT INTO songs (id, title, created_at, updated_at) VALUES ('x', 'T', 1, 1)",
                [],
            )?;
            Err(crate::error::AppError::invalid("falha proposital"))
        });

        assert!(result.is_err());

        let count: i64 = db
            .with_connection(|c| Ok(c.query_row("SELECT count(*) FROM songs", [], |r| r.get(0))?))
            .expect("consulta deve funcionar");
        assert_eq!(count, 0, "a insercao deveria ter sido desfeita");
    }

    #[test]
    fn now_millis_devolve_um_instante_plausivel() {
        // 2020-01-01 em milissegundos. Pega relogio zerado ou unidade trocada.
        assert!(now_millis() > 1_577_836_800_000);
    }
}
