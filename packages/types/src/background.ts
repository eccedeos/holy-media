/**
 * Contratos do fundo da projecao.
 *
 * Espelham `apps/desktop/src-tauri/src/background/model.rs`.
 */

export type BackgroundKind = 'color' | 'gradient' | 'image';

/**
 * O fundo em uso agora. So os campos do `kind` atual tem sentido -- os
 * outros vem `null` (o nucleo nao deixa um valor obsoleto de uma troca
 * anterior escondido nos outros campos).
 */
export interface BackgroundSettings {
  readonly kind: BackgroundKind;
  readonly color: string | null;
  readonly gradientFrom: string | null;
  readonly gradientTo: string | null;
  readonly gradientAngle: number | null;
  /** Data URL (`data:image/...;base64,...`). Nunca um caminho de arquivo. */
  readonly imageData: string | null;
}

/** Entrada de `background_set`. Mesma forma de `BackgroundSettings`. */
export interface BackgroundInput {
  readonly kind: BackgroundKind;
  readonly color?: string;
  readonly gradientFrom?: string;
  readonly gradientTo?: string;
  readonly gradientAngle?: number;
  readonly imageData?: string;
}

/** Nome do evento Tauri emitido quando o fundo muda. */
export const BACKGROUND_CHANGED_EVENT = 'background:changed';
