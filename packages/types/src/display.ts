/**
 * Contratos da janela de projecao.
 *
 * Espelham `apps/desktop/src-tauri/src/display/mod.rs`.
 */

/** Um monitor disponivel para projetar. */
export interface MonitorInfo {
  /** Posicao na lista. E' o que a interface manda de volta ao escolher. */
  readonly index: number;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /**
   * `true` quando o Control Room esta neste monitor. Projetar aqui cobriria a
   * tela do proprio operador.
   */
  readonly isCurrent: boolean;
}

/** Estado da projecao. */
export interface DisplayState {
  readonly monitors: readonly MonitorInfo[];
  readonly isOpen: boolean;
  /** Monitor em uso, quando a projecao esta aberta. */
  readonly monitorIndex: number | null;
}
