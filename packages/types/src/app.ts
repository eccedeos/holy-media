/** Identificacao da aplicacao, devolvida pelo comando Tauri `app_info`. */
export interface AppInfo {
  /** Nome do produto, como declarado no `tauri.conf.json`. */
  readonly name: string;
  /** Versao semver da aplicacao. */
  readonly version: string;
  /** Sistema operacional onde o nucleo Rust esta rodando. */
  readonly os: string;
  /** `true` quando o binario foi compilado em modo debug. */
  readonly debug: boolean;
}
