# Guia de desenvolvimento

## Preparando o ambiente

Ver os requisitos e as bibliotecas de sistema no [README](../README.md).

```bash
pnpm install
pnpm tauri:dev
```

A primeira compilação do Rust leva alguns minutos (o Tauri e suas dependências
são compiladas do zero). As seguintes são incrementais e rápidas.

## Os dois lados do app

| Onde             | O que roda      | Ciclo de feedback          |
| ---------------- | --------------- | -------------------------- |
| `src/`           | interface React | hot reload instantâneo     |
| `src-tauri/src/` | núcleo Rust     | recompila e reinicia o app |

Se a mudança é só de interface, `pnpm dev` no navegador é mais rápido. Os
recursos nativos ficam indisponíveis lá de propósito — a interface detecta e
avisa em vez de quebrar.

## Antes de abrir um PR

```bash
pnpm verify        # format + lint + typecheck + test + build
pnpm rust:test
pnpm rust:clippy
```

É a mesma sequência que o CI executa. Rodar antes evita descobrir depois.

## Convenções

**Idioma.** Código, tipos e nomes de arquivo em inglês. Comentários, commits,
documentação e texto de interface em português.

**Comentário.** Explica _por quê_, não _o quê_. Se o código precisa de comentário
para dizer o que faz, geralmente o código é que precisa mudar.

**TypeScript estrito.** Inclui `noUncheckedIndexedAccess` e
`exactOptionalPropertyTypes`. São chatos e pegam bugs reais — sobretudo em
índice de slide, que é o coração do produto.

**Importação com alias.** `@/` aponta para `apps/desktop/src`. Nada de
`../../../`.

**Domínios não se importam entre si.** O módulo de músicas não importa do módulo
de apresentação, e vice-versa. Quem os une é uma camada acima. Essa regra é o que
mantém o Presentation Engine testável e agnóstico.

## Testes

**Frontend (Vitest + Testing Library).** Testa comportamento, não implementação:
o que o operador vê e o que acontece quando ele age. Lógica pura — motor de
apresentação, parsers, atalhos — é testada diretamente, sem render.

**Rust (`cargo test`).** Cada módulo testa o que expõe. Os contratos
serializados para a interface têm teste de formato, porque quebrá-los quebra o
outro lado silenciosamente.

```bash
pnpm test              # uma vez
pnpm --filter @holy-media/desktop test:watch
pnpm rust:test
```

## Adicionando uma dependência

Ela precisa passar por três perguntas, e a resposta vai no PR:

1. Quanto pesa em kB depois do bundle?
2. Dá para resolver com o que já está no projeto?
3. Isso roda durante o culto? Se sim, quanto custa em CPU e memória?

O orçamento e os limites estão em [performance.md](performance.md).

## Adicionando um comando Tauri

1. Escreva a função em `src-tauri/src/commands.rs` com `#[tauri::command]`.
2. Registre em `invoke_handler` no `lib.rs`.
3. Espelhe o tipo de retorno em `packages/types` (`camelCase` na serialização).
4. Chame pela interface via `invokeCommand`, nunca pelo `invoke` cru — é o
   wrapper que normaliza o erro e mantém o app funcionando no navegador.
5. Teste os dois lados.

## Logs

```ts
import { createLogger } from '@/lib/logger';
const log = createLogger('display');

log.info('projeção iniciada', { monitor: 1 });
```

Chaves sensíveis (`senha`, `token`, `pin`, `chavePix`, ...) são redigidas
automaticamente em qualquer profundidade. Isso é testado — mas continue não
colocando segredo em log de propósito.

## Erros

Nada de `throw` cru atravessando para a interface. Erro vira `AppError`, com
mensagem em português para o operador e detalhe técnico só no log. A regra é
simples: **o operador nunca vê stack trace.**
