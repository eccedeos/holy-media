import type { SlideInput, SongSlide } from '@holy-media/types';

/**
 * Conversao entre a letra como texto e a letra como slides.
 *
 * A decisao de produto por tras disto: ninguem monta uma musica slide a slide
 * num formulario. A letra chega pronta -- de um caderno, de um e-mail, de outro
 * software -- e o operador quer colar e salvar. Entao o formato de entrada e' o
 * texto corrido, e a regra e' a que a pessoa ja usa sem pensar: **linha em
 * branco separa estrofe**.
 *
 * A marcacao do bloco e' opcional. Uma primeira linha entre colchetes ou
 * terminada em dois-pontos vira o rotulo do slide:
 *
 * ```
 * [Verso 1]              Refrao:
 * Primeira linha         Aleluia
 * Segunda linha
 * ```
 *
 * (Estas funcoes servem ao editor. Os importadores de arquivo da Fase 4 vivem
 * no lado Rust e tem os seus proprios formatos -- TXT, JSON, CSV -- que nao
 * seguem necessariamente esta convencao.)
 */

/** `[Refrao]` ou `Refrao:` sozinho na primeira linha de um bloco. */
const BRACKET_LABEL = /^\[(.+)\]$/;
const COLON_LABEL = /^(.{1,40}):$/;

/** Duas ou mais quebras de linha, tolerando espacos nas linhas "vazias". */
const BLOCK_SEPARATOR = /\n[ \t]*\n+/;

function extractLabel(lines: string[]): { label: string; body: string[] } {
  const first = lines[0]?.trim() ?? '';

  const bracket = BRACKET_LABEL.exec(first);
  if (bracket?.[1] !== undefined && lines.length > 1) {
    return { label: bracket[1].trim(), body: lines.slice(1) };
  }

  // Dois-pontos so' vira rotulo se houver corpo depois: uma linha da letra que
  // por acaso termine em ":" nao pode virar rotulo de um slide vazio.
  const colon = COLON_LABEL.exec(first);
  if (colon?.[1] !== undefined && lines.length > 1) {
    return { label: colon[1].trim(), body: lines.slice(1) };
  }

  return { label: '', body: lines };
}

/** Converte o texto do editor em slides prontos para o nucleo. */
export function parseLyrics(text: string): SlideInput[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(BLOCK_SEPARATOR)
    .map((block) => extractLabel(block.split('\n')))
    .map(({ label, body }) => ({ label, content: body.join('\n').trim() }))
    .filter((slide) => slide.content !== '');
}

/**
 * Caminho inverso: slides de volta para o texto do editor.
 *
 * Usado ao abrir uma musica para edicao. O rotulo volta entre colchetes porque
 * e' a forma que nao se confunde com uma linha da letra.
 */
export function formatLyrics(slides: readonly SongSlide[] | readonly SlideInput[]): string {
  return slides
    .map((slide) => (slide.label === '' ? slide.content : `[${slide.label}]\n${slide.content}`))
    .join('\n\n');
}

/** Divide uma lista de tags digitada com virgulas. */
export function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');
}
