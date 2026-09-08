/**
 * Contratos da ordem do culto.
 *
 * Espelham `apps/desktop/src-tauri/src/services/model.rs`.
 */

/** Tipo de item na ordem do culto. Hoje so' musica. */
export type ServiceItemKind = 'song';

/** Um item da ordem do culto. */
export interface ServiceItem {
  readonly id: string;
  readonly position: number;
  readonly kind: ServiceItemKind;
  /** Id da entidade de origem (hoje, `Song.id`). */
  readonly referenceId: string | null;
  /**
   * Copiado no momento em que o item entrou na lista. Se a musica for
   * renomeada depois, a ordem do culto ja preparada continua legivel.
   */
  readonly title: string;
}

/** A ordem do culto, com metadados e itens. */
export interface Service {
  readonly id: string;
  readonly title: string;
  readonly items: readonly ServiceItem[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Versao enxuta para listas, sem os itens. */
export interface ServiceSummary {
  readonly id: string;
  readonly title: string;
  readonly itemCount: number;
  readonly updatedAt: number;
}

/** Entrada para criar ou renomear um culto. */
export interface ServiceInput {
  readonly title: string;
}
