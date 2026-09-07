/**
 * Contratos do dominio de musicas.
 *
 * Espelham as structs em `apps/desktop/src-tauri/src/songs/model.rs`. Mudar um
 * lado sem o outro quebra a ponte em silencio -- ha teste dos dois lados
 * verificando o formato.
 */

/** Bloco de letra que aparece de uma vez na tela. */
export interface SongSlide {
  readonly id: string;
  /** Ordem de projecao, comecando em zero. */
  readonly position: number;
  /** Marcacao que o operador le na lateral: "Verso 1", "Refrao", "Ponte". */
  readonly label: string;
  readonly content: string;
}

/** Musica com a letra inteira. E' o que a tela de edicao recebe. */
export interface Song {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly author: string;
  readonly category: string;
  readonly favorite: boolean;
  readonly tags: readonly string[];
  readonly slides: readonly SongSlide[];
  /** Milissegundos desde a epoca (`new Date(createdAt)`). */
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Versao enxuta usada em listas e resultados de busca.
 *
 * A biblioteca pode ter milhares de linhas; mandar a letra inteira de cada
 * musica pelo IPC so para desenhar um titulo seria desperdicio de memoria.
 */
export interface SongSummary {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly favorite: boolean;
  readonly slideCount: number;
  readonly updatedAt: number;
}

/** Slide enviado pela interface ao criar ou editar. */
export interface SlideInput {
  readonly label: string;
  readonly content: string;
}

/** Dados enviados pela interface ao criar ou editar uma musica. */
export interface SongInput {
  readonly title: string;
  readonly artist: string;
  readonly author: string;
  readonly category: string;
  readonly favorite: boolean;
  readonly tags: readonly string[];
  readonly slides: readonly SlideInput[];
}
