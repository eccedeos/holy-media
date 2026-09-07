# Plano de implementação

Este documento é vivo: ele registra o que foi decidido, o que já está feito e o
que vem a seguir. É atualizado ao fim de cada fase.

## Como este projeto avança

1. Uma fase de cada vez. Fase quebrada não avança.
2. Cada tarefa termina com testes, lint e build verdes — verificados, não
   presumidos.
3. Nada é implementado antes da fase que o exige. Módulo vazio "para preencher
   arquitetura" é dívida, não preparo.
4. Dependência nova precisa de justificativa com custo em kB.

## Análise do ambiente (feita antes de escrever a primeira linha)

| Item              | Situação encontrada                                         |
| ----------------- | ----------------------------------------------------------- |
| Repositório       | vazio, sem commits — sem risco de sobrescrever nada         |
| Node.js           | v22.22.2 ✅                                                 |
| pnpm              | 10.33.0 ✅                                                  |
| Rust / Cargo      | 1.94.1 ✅                                                   |
| Libs do WebKitGTK | **ausentes** — instaladas (webkit2gtk-4.1 2.52.6, GTK 3.24) |
| Registries        | npm e crates.io acessíveis ✅                               |

Dois conflitos de versão apareceram e foram resolvidos na origem:

- **TypeScript 7** já é a versão publicada como `latest`, mas o
  `typescript-eslint` ainda declara `typescript <6.1.0` como peer. O projeto
  fixa **TypeScript 5.9.3** e migra quando a cadeia de lint acompanhar.
- **ESLint 10** é a versão corrente, mas nem todos os plugins do ecossistema
  React o suportam. O projeto usa **ESLint 9.39**, com flat config — que já é o
  formato do 10, então a migração depois é só bump de versão.

## Decisões estruturais desta fase

Cada uma tem um ADR com o raciocínio completo em [`adr/`](adr/).

| Decisão                                        | ADR  |
| ---------------------------------------------- | ---- |
| Monorepo enxuto: só o que já é usado           | 0001 |
| SQLite acessado do Rust, sem ORM               | 0002 |
| Controle remoto nasce como PWA, não app nativo | 0003 |
| Segunda tela é uma segunda janela Tauri        | 0004 |

A escolha de ORM era o ponto onde uma decisão errada custaria caro depois, e por
isso não foi tomada por hábito: Prisma, Drizzle e SQL direto foram comparados
contra o requisito de leveza, e o ADR 0002 mostra por que o ORM perde aqui.

## Resultado da Fase 0

**Entregue:**

- Monorepo pnpm com `apps/desktop`, `packages/types`, `packages/config`
- Tauri v2 compilando e empacotando, com ícones gerados
- React 19 + TypeScript em modo estrito (incluindo `noUncheckedIndexedAccess` e
  `exactOptionalPropertyTypes`)
- Tailwind v4 com tema no CSS, sem arquivo de config
- Botão base no padrão shadcn/ui + `components.json` para adicionar mais depois
- Ponte IPC tipada: erro do Rust vira `AppError` em português, com o detalhe
  técnico indo só para o log
- Logger com níveis, escopo e redação automática de dados sensíveis
- ErrorBoundary cobrindo a interface
- CI no GitHub Actions rodando as duas cadeias (Node e Rust)
- Documentação de arquitetura, roadmap, performance, desenvolvimento e ADRs

**Verificado (não presumido):**

| Verificação                    | Resultado                        |
| ------------------------------ | -------------------------------- |
| `pnpm typecheck`               | 2 projetos, sem erros            |
| `pnpm test` (Vitest)           | 20 testes, todos passando        |
| `pnpm lint` (ESLint)           | 0 erros, 0 avisos                |
| `pnpm format:check` (Prettier) | sem pendências                   |
| `pnpm build` (Vite)            | 229,25 kB JS / **72,67 kB gzip** |
| `cargo test`                   | 4 testes, todos passando         |
| `cargo clippy -- -D warnings`  | limpo                            |
| `cargo fmt`                    | aplicado                         |
| `tauri build --no-bundle`      | binário release: **3,6 MB**      |

Dois números merecem leitura:

O **binário de 3,6 MB** (com o frontend embutido) confirma a aposta no Tauri: um
Electron equivalente parte de ~150 MB. É a diferença entre caber e não caber no
PC de referência.

O **bundle de 71,8 kB gzip** é quase todo React. Metade do orçamento de 150 kB já
está consumida por framework, antes de existir qualquer funcionalidade. Isso é
aceitável, mas define o tom do resto do projeto: o espaço restante é apertado e
cada dependência nova precisa se pagar. O orçamento completo está em
[performance.md](performance.md).

**O que deliberadamente não foi feito:**

- `apps/local-server`, `apps/mobile`, `apps/web` — entram na Fase 3, quando
  houver o que colocar dentro
- `packages/ui`, `packages/bible`, `packages/lyrics`, `packages/presentation`,
  `packages/media`, `packages/websocket`, `packages/sync` — o código desses
  domínios nasce dentro de `apps/desktop` e é extraído para pacote quando um
  segundo consumidor aparecer (na prática, quando o controle remoto chegar).
  Extrair antes disso é custo de manutenção sem benefício
- `docker/`, `scripts/` — não há nada para conteinerizar nem para automatizar
  além do que o `package.json` já cobre
- `docs/database.md`, `docs/presentation-engine.md`,
  `docs/websocket-protocol.md` — documentam código que ainda não existe;
  entram junto com ele, nas fases 1 e 3

## Fase 1, passo 1 — SQLite e músicas

**Entregue:**

- Camada de banco: conexão única com mutex, WAL, chaves estrangeiras ligadas,
  migrations por `PRAGMA user_version` embutidas no binário
- Domínio de músicas: criar, ler, editar, excluir, favoritar, registrar uso
- Letra dividida em slides com ordem de projeção; tags sem duplicar por caixa
- Busca FTS5 por título, artista, autor, letra e tag, sem acento nos dois
  sentidos, com prefixo para filtrar enquanto se digita
- Nove comandos IPC tipados, com espelho em `@holy-media/types`
- Painel de biblioteca: busca com debounce, lista, favoritar, detalhe da música

**Duas decisões que valem registro:**

_A consulta FTS5 é reescrita, nunca concatenada._ A sintaxe do FTS5 tem
operadores próprios, e um `MATCH` inválido **estoura um erro** em vez de
devolver zero resultados — alguém buscando `grande e' o senhor`, com apóstrofo,
veria a busca quebrar ao vivo. O construtor extrai só os termos alfanuméricos e
remonta a expressão. Há teste com aspas, parênteses, `*`, `:` e operadores.

_A busca tem guarda de corrida._ O operador digita "a" e depois "ab"; se a
resposta de "a" voltar por último, a lista mostra o resultado errado para o
texto que está na tela. Cada busca leva um número e só a mais recente escreve no
estado. É um bug que quase nunca aparece em desenvolvimento e sempre aparece em
máquina lenta — que é justamente o alvo do produto.

**Verificado, não presumido:**

| Verificação                                | Resultado                     |
| ------------------------------------------ | ----------------------------- |
| `cargo test`                               | **52 testes**, todos passando |
| `pnpm test` (Vitest)                       | **39 testes**, todos passando |
| `cargo clippy -- -D warnings`              | limpo                         |
| `pnpm lint` / `typecheck` / `format:check` | limpos                        |
| Busca em 5000 músicas (release)            | **11 ms** — orçamento: 50 ms  |
| Bundle JS                                  | 74,1 kB gzip (+2,3 kB)        |

O custo da feature inteira no bundle foi de 2,3 kB, porque a busca vive no
SQLite e não em JavaScript. É a decisão do ADR 0002 se pagando na prática.

**Três bugs encontrados pelas próprias ferramentas, e o que cada um ensinou:**

1. `clippy` apontou código morto. A correção não foi silenciar o aviso: o campo
   `name` da migration passou a nomear qual arquivo falhou no diagnóstico —
   antes, um erro de migration deixaria só "erro de sintaxe" no log.
2. Um teste com timers falsos estourou e vazou os timers para os testes
   seguintes: **um** erro apareceu como sete. Além de corrigir a causa, o
   `setup.ts` passou a restaurar os timers reais no `afterEach`, para que uma
   falha futura fique isolada.
3. `tsc` pegou um `expect(...).toBe(valor, mensagem)` que o Vitest ignorava em
   silêncio — a mensagem nunca teria aparecido.

## Próximo passo

Formulário de cadastro e edição de músicas na interface, fechando o CRUD de
ponta a ponta. Depois: seed de exemplo, e então o Presentation Engine.

## Fase 1 — passos restantes

Ordem de execução, escolhida para que cada passo seja demonstrável sozinho:

1. ~~**SQLite no núcleo Rust**~~ — feito.
2. ~~**Domínio de músicas**~~ — feito.
3. ~~**Busca com FTS5**~~ — feito, 11 ms em 5000 músicas.
4. **Presentation Engine** — lógica pura, coberta por testes antes da UI.
5. **Segunda tela** — janela dedicada, escolha de monitor, fullscreen, preto.
6. **Bíblia** — importação de uma tradução em domínio público, busca, navegação.
7. **Ordem do culto** — playlist persistida.
8. **Backgrounds e QR Code**.
9. **`KeyboardShortcutService`** — atalhos num só lugar, configuráveis.

O passo 4 vem antes do 5 de propósito: o motor precisa estar testado e correto
antes de existir uma tela para escondê-lo.

## Riscos conhecidos

| Risco                                               | Como estamos lidando                                          |
| --------------------------------------------------- | ------------------------------------------------------------- |
| Comportamento de multi-monitor varia por SO         | isolar em um módulo `display` com fallback para janela normal |
| WebView do sistema difere entre Windows/Linux/macOS | build target `es2022`, sem APIs de ponta; testar nos três     |
| Busca degradar com biblioteca grande                | FTS5 desde o início + teste de performance com 5000 músicas   |
| Direitos autorais de letras e traduções bíblicas    | só importação; nada protegido é distribuído com o software    |
| Escopo do MVP inchar                                | critério de pronto da Fase 1 é literal: conduzir um culto     |
| Vídeo pesar demais no PC alvo                       | Fase 2, medido contra o orçamento antes de virar padrão       |
