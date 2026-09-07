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
  /** Falha ao abrir, migrar ou consultar o banco local. */
  | 'DATABASE_FAILED'
  /** A entidade pedida nao existe (musica ja excluida, id invalido). */
  | 'NOT_FOUND'
  /** O dado enviado pela interface nao passa nas regras do dominio. */
  | 'INVALID_INPUT'
  /** Falha ao abrir, posicionar ou fechar a janela de projecao. */
  | 'DISPLAY_FAILED'
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
