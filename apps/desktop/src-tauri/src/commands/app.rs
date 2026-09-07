//! Comandos de identificacao da aplicacao.

use serde::Serialize;

/// Identificacao da aplicacao. Espelha `AppInfo` em `@holy-media/types`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub os: String,
    pub debug: bool,
}

impl AppInfo {
    /// Monta o `AppInfo` a partir dos metadados de compilacao.
    pub fn current() -> Self {
        Self {
            name: "Holy Media".to_owned(),
            version: env!("CARGO_PKG_VERSION").to_owned(),
            os: std::env::consts::OS.to_owned(),
            debug: cfg!(debug_assertions),
        }
    }
}

/// Handshake usado pela interface para confirmar que o nucleo esta vivo.
#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo::current()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_reporta_a_versao_do_pacote() {
        assert_eq!(AppInfo::current().version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn current_reporta_um_sistema_operacional_conhecido() {
        assert!(!AppInfo::current().os.is_empty());
    }

    #[test]
    fn serializa_em_camel_case_para_o_typescript() {
        let json = serde_json::to_value(AppInfo {
            name: "Holy Media".to_owned(),
            version: "0.0.1".to_owned(),
            os: "linux".to_owned(),
            debug: true,
        })
        .expect("AppInfo deve serializar");

        assert_eq!(json["name"], "Holy Media");
        assert_eq!(json["version"], "0.0.1");
        assert_eq!(json["os"], "linux");
        assert_eq!(json["debug"], true);
    }

    #[test]
    fn o_comando_devolve_o_mesmo_que_current() {
        assert_eq!(app_info(), AppInfo::current());
    }
}
