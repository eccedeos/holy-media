//! Modelo do fundo da projecao.
//!
//! Cada struct daqui tem espelho em `@holy-media/types`.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppErrorCode, AppResult};

/// As tres formas de fundo pedidas pelo roadmap: cor solida, gradiente e
/// imagem. Guardado como `TEXT` no banco (`as_sql`/`from_sql`), no mesmo
/// padrao de `ServiceItemKind`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BackgroundKind {
    Color,
    Gradient,
    Image,
}

impl BackgroundKind {
    pub(super) fn as_sql(&self) -> &'static str {
        match self {
            Self::Color => "color",
            Self::Gradient => "gradient",
            Self::Image => "image",
        }
    }

    pub(super) fn from_sql(value: &str) -> AppResult<Self> {
        match value {
            "color" => Ok(Self::Color),
            "gradient" => Ok(Self::Gradient),
            "image" => Ok(Self::Image),
            other => Err(AppError::new(
                AppErrorCode::DatabaseFailed,
                "O fundo salvo tem um tipo desconhecido.",
            )
            .with_detail(format!("kind inesperado: {other}"))),
        }
    }
}

/// O fundo em uso agora. So os campos do `kind` atual tem sentido -- os
/// outros ficam `None`, em vez de um valor obsoleto de uma troca anterior.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundSettings {
    pub kind: BackgroundKind,
    pub color: Option<String>,
    pub gradient_from: Option<String>,
    pub gradient_to: Option<String>,
    pub gradient_angle: Option<i64>,
    /// Data URL (`data:image/...;base64,...`). Nunca um caminho de arquivo --
    /// ver o comentario da migration sobre por que a imagem mora no banco.
    pub image_data: Option<String>,
}

/// Entrada para trocar o fundo. Mesma forma de `BackgroundSettings`; existe
/// como tipo proprio porque `validated()` so faz sentido do lado de quem
/// escreve, nunca de quem le.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundInput {
    pub kind: BackgroundKind,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub gradient_from: Option<String>,
    #[serde(default)]
    pub gradient_to: Option<String>,
    #[serde(default)]
    pub gradient_angle: Option<i64>,
    #[serde(default)]
    pub image_data: Option<String>,
}

/// Tamanho maximo de uma imagem de fundo, ja em base64 (~6 MB, uma imagem
/// JPEG de tela cheia bem comprimida cabe bem dentro disto). O limite existe
/// porque a imagem inteira fica na memoria de duas janelas (Control Room e
/// projecao) -- um arquivo enorme escolhido por engano nao pode inchar as
/// duas ao mesmo tempo.
const MAX_IMAGE_DATA_LEN: usize = 6_000_000;

fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

impl BackgroundInput {
    /// Valida so' o que o `kind` escolhido exige -- uma cor de gradiente
    /// invalida nao pode bloquear a troca para uma cor solida.
    pub fn validated(self) -> AppResult<Self> {
        match self.kind {
            BackgroundKind::Color => {
                if !is_hex_color(self.color.as_deref().unwrap_or_default()) {
                    return Err(AppError::invalid("Cor invalida. Use o formato #RRGGBB."));
                }
            }
            BackgroundKind::Gradient => {
                let from_ok = is_hex_color(self.gradient_from.as_deref().unwrap_or_default());
                let to_ok = is_hex_color(self.gradient_to.as_deref().unwrap_or_default());
                if !from_ok || !to_ok {
                    return Err(AppError::invalid(
                        "Cores do gradiente invalidas. Use o formato #RRGGBB.",
                    ));
                }
                if let Some(angle) = self.gradient_angle {
                    if !(0..=360).contains(&angle) {
                        return Err(AppError::invalid(
                            "Angulo do gradiente deve estar entre 0 e 360.",
                        ));
                    }
                }
            }
            BackgroundKind::Image => {
                let data = self.image_data.as_deref().unwrap_or_default();
                if !data.starts_with("data:image/") {
                    return Err(AppError::invalid("Envie um arquivo de imagem valido."));
                }
                if data.len() > MAX_IMAGE_DATA_LEN {
                    return Err(AppError::invalid(
                        "Imagem muito grande. Escolha um arquivo menor.",
                    ));
                }
            }
        }
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn cor_valida_passa() {
        assert!(cor("#1a2b3c").validated().is_ok());
    }

    #[test]
    fn cor_sem_cerquilha_e_rejeitada() {
        assert!(cor("1a2b3c").validated().is_err());
    }

    #[test]
    fn cor_com_letra_invalida_e_rejeitada() {
        assert!(cor("#1a2b3g").validated().is_err());
    }

    #[test]
    fn cor_vazia_e_rejeitada() {
        assert!(cor("").validated().is_err());
    }

    #[test]
    fn gradiente_com_as_duas_cores_passa() {
        let input = BackgroundInput {
            kind: BackgroundKind::Gradient,
            color: None,
            gradient_from: Some("#000000".to_owned()),
            gradient_to: Some("#ffffff".to_owned()),
            gradient_angle: Some(45),
            image_data: None,
        };
        assert!(input.validated().is_ok());
    }

    #[test]
    fn gradiente_sem_angulo_usa_o_padrao_do_frontend_e_ainda_passa() {
        let input = BackgroundInput {
            kind: BackgroundKind::Gradient,
            color: None,
            gradient_from: Some("#000000".to_owned()),
            gradient_to: Some("#ffffff".to_owned()),
            gradient_angle: None,
            image_data: None,
        };
        assert!(input.validated().is_ok());
    }

    #[test]
    fn gradiente_com_uma_cor_invalida_e_rejeitado() {
        let input = BackgroundInput {
            kind: BackgroundKind::Gradient,
            color: None,
            gradient_from: Some("#000000".to_owned()),
            gradient_to: Some("nao e' cor".to_owned()),
            gradient_angle: None,
            image_data: None,
        };
        assert!(input.validated().is_err());
    }

    #[test]
    fn gradiente_com_angulo_fora_da_faixa_e_rejeitado() {
        let input = BackgroundInput {
            kind: BackgroundKind::Gradient,
            color: None,
            gradient_from: Some("#000000".to_owned()),
            gradient_to: Some("#ffffff".to_owned()),
            gradient_angle: Some(361),
            image_data: None,
        };
        assert!(input.validated().is_err());
    }

    #[test]
    fn imagem_com_data_url_valida_passa() {
        let input = BackgroundInput {
            kind: BackgroundKind::Image,
            color: None,
            gradient_from: None,
            gradient_to: None,
            gradient_angle: None,
            image_data: Some("data:image/png;base64,aGVsbG8=".to_owned()),
        };
        assert!(input.validated().is_ok());
    }

    #[test]
    fn imagem_sem_data_url_e_rejeitada() {
        let input = BackgroundInput {
            kind: BackgroundKind::Image,
            color: None,
            gradient_from: None,
            gradient_to: None,
            gradient_angle: None,
            image_data: Some("nao e' uma data url".to_owned()),
        };
        assert!(input.validated().is_err());
    }

    #[test]
    fn imagem_grande_demais_e_rejeitada() {
        let enorme = "a".repeat(MAX_IMAGE_DATA_LEN + 1);
        let input = BackgroundInput {
            kind: BackgroundKind::Image,
            color: None,
            gradient_from: None,
            gradient_to: None,
            gradient_angle: None,
            image_data: Some(format!("data:image/png;base64,{enorme}")),
        };
        assert!(input.validated().is_err());
    }

    #[test]
    fn kind_serializa_em_camel_case() {
        let json = serde_json::to_value(BackgroundKind::Gradient).expect("serializa");
        assert_eq!(json, "gradient");
    }
}
