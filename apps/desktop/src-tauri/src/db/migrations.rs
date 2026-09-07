//! Migrations do banco local.
//!
//! O esquema evolui por arquivos `.sql` numerados, embutidos no binario em
//! tempo de compilacao. Isso mantem a instalacao com um arquivo so -- nao ha
//! diretorio de migrations para o usuario perder -- e faz uma migration
//! ausente virar erro de compilacao, nao erro no domingo de manha.
//!
//! O controle de versao usa `PRAGMA user_version`, que e' um inteiro que o
//! proprio SQLite guarda no cabecalho do arquivo. Sem tabela de controle,
//! sem dependencia externa.

use rusqlite::Connection;

use crate::error::{AppError, AppResult};

/// As migrations, em ordem. **Nunca edite uma migration ja publicada**: um
/// banco existente nao a executaria de novo. Adicione a proxima no fim.
const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "songs",
    sql: include_str!("migrations/0001_songs.sql"),
}];

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

/// Versao de esquema que este binario espera.
#[cfg(test)]
fn target_version() -> i64 {
    MIGRATIONS.last().map_or(0, |migration| migration.version)
}

/// Aplica todas as migrations pendentes.
///
/// Cada uma roda dentro de uma transacao junto com a atualizacao da
/// `user_version`: ou a migration inteira vale, ou o banco continua na versao
/// anterior. Um banco meio migrado seria pior do que um banco antigo.
pub fn run(connection: &Connection) -> AppResult<()> {
    let current: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    for migration in MIGRATIONS.iter().filter(|m| m.version > current) {
        connection
            .execute_batch(&format!(
                "BEGIN;
                 {}
                 PRAGMA user_version = {};
                 COMMIT;",
                migration.sql, migration.version
            ))
            // Sem o nome, um banco que falha ao migrar deixa so' "erro de
            // sintaxe" no log, sem dizer em qual arquivo procurar.
            .map_err(|error| {
                AppError::from(error).with_detail(format!(
                    "migration {:04} ({}) falhou: consulte o arquivo SQL correspondente",
                    migration.version, migration.name
                ))
            })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn versao(connection: &Connection) -> i64 {
        connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("pragma")
    }

    #[test]
    fn banco_vazio_chega_na_versao_alvo() {
        let connection = Connection::open_in_memory().expect("conexao");
        run(&connection).expect("migrations devem aplicar");

        assert_eq!(versao(&connection), target_version());
    }

    #[test]
    fn rodar_de_novo_nao_faz_nada() {
        let connection = Connection::open_in_memory().expect("conexao");
        run(&connection).expect("primeira passada");
        // A segunda passada quebraria com "table already exists" se as
        // migrations nao fossem puladas pela versao.
        run(&connection).expect("segunda passada deve ser inofensiva");

        assert_eq!(versao(&connection), target_version());
    }

    #[test]
    fn as_versoes_sao_sequenciais_e_comecam_em_um() {
        for (index, migration) in MIGRATIONS.iter().enumerate() {
            assert_eq!(
                migration.version,
                index as i64 + 1,
                "migration '{}' esta fora de ordem",
                migration.name
            );
        }
    }

    #[test]
    fn o_indice_de_busca_existe_depois_de_migrar() {
        let connection = Connection::open_in_memory().expect("conexao");
        run(&connection).expect("migrations");

        let existe: i64 = connection
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'songs_fts'",
                [],
                |row| row.get(0),
            )
            .expect("consulta");

        assert_eq!(existe, 1, "sem FTS5 a busca nao seria instantanea");
    }
}
