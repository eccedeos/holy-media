/**
 * Contratos do motor de apresentacao.
 *
 * Espelham `apps/desktop/src-tauri/src/presentation/model.rs`.
 */

/** Um slide ja resolvido, pronto para projetar. */
export interface PresentationSlide {
  /** Marcacao para o operador ("Verso 1"). **Nao vai para a tela.** */
  readonly label: string;
  /** O que a congregacao le. */
  readonly content: string;
}

/**
 * Entrada de `presentation_present_text`: um bloco de texto avulso, ja
 * dividido em slides pela interface (mesma regra do editor de letras).
 */
export type PresentationSlideInput = PresentationSlide;

/**
 * O que a segunda tela exibe neste instante.
 *
 * Uniao discriminada por `kind`: a janela de projecao faz um `switch` sobre ele
 * e nao decide mais nada.
 */
export type PresentationOutput =
  /** Nada carregado. A tela de espera aparece aqui (Fase 2). */
  | { readonly kind: 'idle' }
  /** Tela preta pedida pelo operador. */
  | { readonly kind: 'black' }
  /** Conteudo no ar, para projetar como texto. */
  | { readonly kind: 'slide'; readonly content: string }
  /** Conteudo no ar, para desenhar como QR Code. `content` e' o payload
   * (URL, texto de PIX) -- quem desenha o codigo e' a tela, nunca o nucleo. */
  | { readonly kind: 'qr'; readonly content: string };

/** Retrato do motor, recebido pelo Control Room e pela segunda tela. */
export interface PresentationState {
  readonly output: PresentationOutput;
  /** Id da musica no ar, para destacar a linha na biblioteca. */
  readonly sourceId: string | null;
  /** Titulo do que esta carregado. Nunca projetado. */
  readonly title: string;
  /** Marcacao do slide atual, para o operador. Nunca projetada. */
  readonly label: string;
  readonly index: number;
  readonly total: number;
  readonly blackedOut: boolean;
  readonly canGoNext: boolean;
  readonly canGoPrevious: boolean;
}

/** Nome do evento Tauri emitido a cada mudanca do motor. */
export const PRESENTATION_STATE_EVENT = 'presentation:state';
