//! Persistencia do fundo da projecao.
//!
//! Uma linha so ("current"): a Fase 1 tem um operador so e um fundo no ar
//! por vez -- ver o comentario da migration 0004.

use rusqlite::{params, Connection};

use super::model::{BackgroundInput, BackgroundKind, BackgroundSettings};
use crate::db::{now_millis, Database};
use crate::error::AppResult;

/// Le a linha atual. Recebe a conexao diretamente (em vez de `&Database`)
/// para poder ser chamada de dentro de `set`, sem travar o mutex duas vezes.
fn load(conn: &Connection) -> AppResult<BackgroundSettings> {
    let (kind, color, gradient_from, gradient_to, gradient_angle, image_data) = conn.query_row(
        "SELECT kind, color, gradient_from, gradient_to, gradient_angle, image_data
           FROM background_settings
          WHERE id = 'current'",
        [],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        },
    )?;

    Ok(BackgroundSettings {
        kind: BackgroundKind::from_sql(&kind)?,
        color,
        gradient_from,
        gradient_to,
        gradient_angle,
        image_data,
    })
}

pub fn get(db: &Database) -> AppResult<BackgroundSettings> {
    db.with_connection(load)
}

/// Troca o fundo. Os campos que nao pertencem ao `kind` escolhido sao
/// gravados como `NULL` -- nao ha' um "gradiente com cor de fundo antiga
/// escondida atras", so' o que o `kind` atual usa.
pub fn set(db: &Database, input: BackgroundInput) -> AppResult<BackgroundSettings> {
    let input = input.validated()?;

    db.with_connection(|c| {
        c.execute(
            "UPDATE background_settings
                SET kind = ?1, color = ?2, gradient_from = ?3, gradient_to = ?4,
                    gradient_angle = ?5, image_data = ?6, updated_at = ?7
              WHERE id = 'current'",
            params![
                input.kind.as_sql(),
                input.color,
                input.gradient_from,
                input.gradient_to,
                input.gradient_angle,
                input.image_data,
                now_millis(),
            ],
        )?;
        load(c)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::background::model::BackgroundInput;

    fn cor(hex: &str) -> BackgroundInput {
        BackgroundInput {
            kind: BackgroundKind::Color,
            color: Some(hex.to_owned()),
            gradient_from: None,
            gradient_to: None,
            gradient_angle: None,
            image_data: None,
        }
    }

    #[test]
    fn o_fundo_padrao_e_preto() {
        let db = Database::open_in_memory().expect("banco");
        let settings = get(&db).expect("deveria existir uma linha padrao");

        assert_eq!(settings.kind, BackgroundKind::Color);
        assert_eq!(settings.color.as_deref(), Some("#000000"));
    }

    #[test]
    fn trocar_para_gradiente_persiste_e_le_de_volta() {
        let db = Database::open_in_memory().expect("banco");

        let input = BackgroundInput {
            kind: BackgroundKind::Gradient,
            color: None,
            gradient_from: Some("#101010".to_owned()),
            gradient_to: Some("#f0f0f0".to_owned()),
            gradient_angle: Some(135),
            image_data: None,
        };
        set(&db, input).expect("deveria trocar");

        let settings = get(&db).expect("le de volta");
        assert_eq!(settings.kind, BackgroundKind::Gradient);
        assert_eq!(settings.gradient_from.as_deref(), Some("#101010"));
        assert_eq!(settings.gradient_to.as_deref(), Some("#f0f0f0"));
        assert_eq!(settings.gradient_angle, Some(135));
    }

    #[test]
    fn trocar_de_gradiente_para_cor_limpa_os_campos_do_gradiente() {
        let db = Database::open_in_memory().expect("banco");
        set(
            &db,
            BackgroundInput {
                kind: BackgroundKind::Gradient,
                color: None,
                gradient_from: Some("#101010".to_owned()),
                gradient_to: Some("#f0f0f0".to_owned()),
                gradient_angle: Some(90),
                image_data: None,
            },
        )
        .expect("deveria trocar para gradiente");

        set(&db, cor("#123456")).expect("deveria trocar para cor");

        let settings = get(&db).expect("le de volta");
        assert_eq!(settings.kind, BackgroundKind::Color);
        assert_eq!(settings.color.as_deref(), Some("#123456"));
        // Sem isto, um gradiente antigo continuaria escondido no banco depois
        // da troca -- inofensivo hoje, mas uma armadilha para o dia em que
        // alguem ler esses campos sem checar o `kind` primeiro.
        assert_eq!(settings.gradient_from, None);
        assert_eq!(settings.gradient_to, None);
        assert_eq!(settings.gradient_angle, None);
    }

    #[test]
    fn entrada_invalida_nao_chega_a_gravar() {
        let db = Database::open_in_memory().expect("banco");

        let resultado = set(&db, cor("nao e' uma cor"));
        assert!(resultado.is_err());

        // O fundo padrao continua no lugar -- a tentativa invalida nao deixou
        // o banco num estado parcial.
        let settings = get(&db).expect("le de volta");
        assert_eq!(settings.color.as_deref(), Some("#000000"));
    }

    #[test]
    fn imagem_e_persistida_e_lida_de_volta() {
        let db = Database::open_in_memory().expect("banco");
        let data_url = "data:image/png;base64,aGVsbG8=";

        set(
            &db,
            BackgroundInput {
                kind: BackgroundKind::Image,
                color: None,
                gradient_from: None,
                gradient_to: None,
                gradient_angle: None,
                image_data: Some(data_url.to_owned()),
            },
        )
        .expect("deveria trocar para imagem");

        let settings = get(&db).expect("le de volta");
        assert_eq!(settings.kind, BackgroundKind::Image);
        assert_eq!(settings.image_data.as_deref(), Some(data_url));
    }
}
