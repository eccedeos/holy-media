/**
 * Categorias de erro que a interface sabe traduzir para uma mensagem amigavel.
 *
 * A regra da secao 22 do briefing: o operador nunca ve stack trace. O detalhe
 * tecnico vai para o log; a UI mostra apenas `message`.
 */
export type AppErrorCode =
  /** Falha na ponte IPC entre a interface e o nucleo Rust. */
  | 'IPC_FAILED'
  /** A interface esta rodando fora do Tauri (ex.: `vite dev` puro no browser). */
  | 'IPC_UNAVAILABLE'
  /** Erro nao classificado. */
  | 'UNKNOWN';

/** Erro normalizado que atravessa a fronteira Rust -> interface. */
export interface AppError {
  readonly code: AppErrorCode;
  /** Mensagem em portugues, pronta para ser exibida ao operador. */
  readonly message: string;
  /** Detalhe tecnico bruto. Destino: log. Nunca a tela. */
  readonly detail?: string;
}
