import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda contra um bug que nao da erro em lugar nenhum.
 *
 * No Tailwind v4, `text-[--color-content-muted]` compila para
 * `color: --color-content-muted` -- CSS invalido, sem `var()`. O build passa,
 * os testes passam, e a tela simplesmente aparece sem estilo. So' foi
 * descoberto rodando o aplicativo e olhando.
 *
 * A forma correta e' usar os utilitarios que o Tailwind gera a partir do
 * bloco `@theme`: `text-content-muted`, `bg-surface-raised`, `border-line`.
 */

// `process.cwd()` no Vitest e' a raiz do pacote; `import.meta.url` aqui e' uma
// URL do Vite, nao um caminho de disco.
const SOURCE_DIR = join(process.cwd(), 'src');
const BROKEN_ARBITRARY_COLOR = /(?:bg|text|border|ring|fill|stroke)-\[--color-/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('tema', () => {
  it('nao usa a sintaxe de cor arbitraria que o Tailwind v4 nao resolve', () => {
    const culpados = sourceFiles(SOURCE_DIR).filter(
      (file) =>
        !file.endsWith('theme.test.ts') && BROKEN_ARBITRARY_COLOR.test(readFileSync(file, 'utf8')),
    );

    expect(culpados, 'use os utilitarios do @theme (ex.: text-content-muted)').toEqual([]);
  });
});
