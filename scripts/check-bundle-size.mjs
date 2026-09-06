#!/usr/bin/env node
/**
 * Faz o orçamento de performance falhar o build em vez de virar boa intenção.
 *
 * Roda depois de `pnpm build` e compara o JavaScript gerado (comprimido, que é
 * o que o WebView realmente baixa e precisa parsear) contra o teto definido em
 * docs/performance.md.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = 'apps/desktop/dist/assets';
const JS_BUDGET_BYTES = 150 * 1024;

function gzippedSize(path) {
  return gzipSync(readFileSync(path), { level: 9 }).length;
}

let files;
try {
  files = readdirSync(ASSETS_DIR);
} catch {
  console.error(`Nada em ${ASSETS_DIR}. Rode "pnpm build" antes.`);
  process.exit(1);
}

let totalJs = 0;
for (const file of files.filter((name) => name.endsWith('.js'))) {
  const size = gzippedSize(join(ASSETS_DIR, file));
  totalJs += size;
  console.log(`  ${file.padEnd(40)} ${(size / 1024).toFixed(1)} kB gzip`);
}

const usedPercent = ((totalJs / JS_BUDGET_BYTES) * 100).toFixed(0);
console.log(
  `\nJavaScript: ${(totalJs / 1024).toFixed(1)} kB gzip ` +
    `de ${JS_BUDGET_BYTES / 1024} kB permitidos (${usedPercent} % do orçamento).`,
);

if (totalJs > JS_BUDGET_BYTES) {
  console.error(
    '\nOrçamento de bundle estourado. Ou a dependência nova se justifica e o ' +
      'teto muda em docs/performance.md, ou ela sai.',
  );
  process.exit(1);
}
