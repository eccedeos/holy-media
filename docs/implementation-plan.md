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

## Fase 1, passo 2 — CRUD na interface, e o app rodando de verdade

**Entregue:**

- Formulário de cadastro e edição. A letra é um campo de texto só: **linha em
  branco separa slides**, e uma primeira linha como `[Refrão]` vira a marcação
  do bloco. O contador mostra, enquanto se digita, quantos slides vão para a
  tela. A razão é que ninguém monta uma música slide a slide num formulário — a
  letra chega pronta, de um caderno ou de um e-mail, e o operador quer colar e
  salvar.
- Exclusão com confirmação no próprio lugar.
- Músicas de exemplo, oferecidas quando a biblioteca está vazia. **Não há seed
  automático:** um app que se enche de músicas falsas na primeira abertura
  obriga o operador a limpar a biblioteca antes de usar. O conteúdo é original,
  não hino conhecido — traduções de hinos têm copyright próprio.

**Três defeitos que só apareceram ao rodar o aplicativo:**

1. **Todo o tema estava sem efeito.** No Tailwind v4,
   `text-[--color-content-muted]` compila para `color: --color-content-muted` —
   CSS inválido, sem `var()`. O build passava, os testes passavam, e a tela
   aparecia sem estilo. A forma correta é usar os utilitários que o Tailwind
   gera do bloco `@theme`. Como esse bug não produz erro em lugar nenhum, ficou
   um teste que varre o código e falha se a sintaxe voltar.
2. **A lista piscava entre buscas.** Cada consulta voltava ao estado `loading`,
   trocando os resultados por "Buscando..." a cada palavra digitada. Agora esse
   texto só aparece na abertura.
3. **A RAM real era o dobro do orçamento.** Ver abaixo.

**A medição de memória, e uma correção de rumo:**

O limite de 150 MB em `performance.md` tinha sido escrito antes de qualquer
medição. A primeira execução real deu **345 MB de PSS**, dos quais 235 MB são do
`WebKitWebProcess` — o motor do Tauri no Linux, medido sem GPU.

Desligar o modo de composição do WebKit levou o total a **231 MB**, economia de
114 MB. Está aplicado, respeitando a variável se o usuário já a tiver definido,
e marcado para reavaliação na Fase 2, quando houver vídeo.

O orçamento foi revisado para 250 MB no Linux, e Windows ficou marcado como não
medido.

_(Correção posterior: o Windows foi medido, e o orçamento voltou a 150 MB. A
revisão para 250 MB tinha sido feita em cima do PSS, uma métrica pessimista; em
memória privada — a que responde "quanto o app tira da máquina" — o Windows
consome 83 MB e o Linux 149 MB, ambos dentro do limite original. Ver
[performance.md](performance.md).)_

**Verificado rodando o aplicativo, não só pelos testes:**

| Verificação                                    | Resultado              |
| ---------------------------------------------- | ---------------------- |
| Aplicativo sobe e cria o banco (com WAL)       | ✅                     |
| Músicas de exemplo entram pela interface       | ✅                     |
| Buscar `coracao` encontra "Coração Agradecido" | ✅                     |
| `cargo test`                                   | **62 testes** passando |
| `pnpm test` (Vitest)                           | **64 testes** passando |
| clippy / eslint / tsc / prettier               | limpos                 |
| RAM em repouso (Linux, sem GPU)                | 231 MB                 |
| Bundle JS                                      | 76,0 kB gzip (+1,9 kB) |

## Fase 1, passo 3 — Presentation Engine

**Entregue:**

- Motor de apresentação em lógica pura: sem banco, sem DOM, sem Tauri, sem
  relógio. 23 testes que rodam em microssegundos.
- Nove comandos IPC, com evento `presentation:state` para todas as janelas.
- Controle no Control Room: apresentar, avançar, voltar, tela preta, tirar do
  ar, e prévia do que está sendo projetado.
- Slides clicáveis no detalhe da música, com destaque do que está no ar.

**A decisão central: o motor não conhece música.** Ele recebe slides já
resolvidos. Quem traduz uma música em slides é a camada de comandos. É essa
fronteira que vai permitir acrescentar Bíblia, vídeo ou QR Code sem tocar no
motor — e é ela que o mantém testável por inteiro.

**Comportamentos que vêm de como um culto funciona**, cada um com teste: a
navegação não circula (voltar ao verso 1 sozinho seria pior que nada); índice
fora da faixa é ignorado, não truncado; a tela preta preserva a posição; carregar
outra música mantém a tela preta — se reacendesse, a congregação veria a
preparação; e o rótulo do slide ("Refrão") nunca é projetado.

**A store do frontend não recalcula nada**, nem os limites de navegação. Guarda o
último estado que o núcleo mandou. Duplicar a regra criaria uma segunda verdade,
e as duas divergiriam no pior momento. É também o que torna o controle remoto da
Fase 3 quase gratuito: o celular vira mais um observador.

**Dois defeitos encontrados rodando o aplicativo:**

1. **A biblioteca se reembaralhava entre aberturas.** As músicas do seed são
   inseridas no mesmo milissegundo, e `ORDER BY updated_at DESC` com empate
   devolve ordem arbitrária no SQLite. Corrigido com desempate por título — e o
   teste foi verificado quebrando de propósito, para provar que ele pega.
2. **Um vão morto na coluna direita**, porque a prévia estava presa ao rodapé.
   Subiu para o topo; o espaço abaixo fica para a ordem do culto.

**Verificado rodando o aplicativo:** música colocada no ar, dois avanços até
"Verso 2 · 3 de 4", tela preta ativa **com a posição preservada** — a prévia
mostra preto enquanto o Control Room continua marcando o slide no ar.

| Verificação                      | Resultado              |
| -------------------------------- | ---------------------- |
| `cargo test`                     | **88 testes** passando |
| `pnpm test` (Vitest)             | **81 testes** passando |
| clippy / eslint / tsc / prettier | limpos                 |
| Bundle JS                        | 78,1 kB gzip (+2,1 kB) |

## Fase 1, passo 4 — A segunda tela

**Entregue:**

- Janela de projeção dedicada, criada sob demanda, posicionada no monitor
  escolhido e em tela cheia, sem bordas e sem barra de título.
- Seletor de monitor no Control Room, com resolução e um aviso de qual monitor é
  o do próprio operador — projetar ali cobriria a tela de quem está operando.
- A tela renderiza **apenas** o `Output`: sem menus, sem posição, sem título,
  sem marcação de slide, sem cursor.
- Capability própria para a janela de projeção, com `core:event:default` e nada
  mais.

**O bug que só apareceu rodando o aplicativo.** A janela abria, ficava em tela
cheia — e mostrava preto, com a música no ar. A causa: as capabilities do Tauri
v2 são **por janela**, e a janela nova não estava em nenhuma. Sem permissão, o
`listen` era negado, a assinatura estourava dentro do `connect()` e levava junto
a busca do estado inicial. Duas correções, porque o problema tinha duas partes:

1. A janela de projeção ganhou capability própria — com o mínimo, já que ela só
   precisa escutar.
2. `connect()` passou a assinar e buscar de forma independente. Se a assinatura
   falhar, o estado inicial ainda chega, e a tela mostra o slide em vez de preto.

Nenhum teste unitário pegaria isso: cada peça funcionava sozinha.

**Decisão de sincronia:** o papel da janela é decidido de forma síncrona, por uma
marca que o núcleo injeta antes de qualquer script da página. Ler o rótulo pela
API do Tauri seria assíncrono, e a projeção piscaria o Control Room por um
quadro — na frente da igreja inteira.

**Verificado rodando o aplicativo:**

| Verificação                                                    | Resultado    |
| -------------------------------------------------------------- | ------------ |
| A janela de projeção abre (duas janelas, títulos ok)           | ✅           |
| Tela cheia, só conteúdo, sem cursor                            | ✅           |
| Mostra o slide que já estava no ar ao abrir                    | ✅           |
| **Acompanha ao vivo:** avançar no Control Room muda a projeção | ✅           |
| `cargo test` / `pnpm test`                                     | 88 / 99      |
| clippy / eslint / tsc / prettier                               | limpos       |
| Bundle JS                                                      | 79,0 kB gzip |

**Não verificado aqui:** o posicionamento em **dois monitores**. O Xvfb deste
ambiente não expõe mais de um monitor nem com Xinerama, então o caminho testado
foi sempre com um só. A escolha de monitor, a listagem e o tratamento de "monitor
desconectado" estão implementados e cobertos por teste, mas o posicionamento real
numa segunda tela precisa de uma máquina com projetor ou TV ligada.

## Fase 1, passo 5 — Ordem do culto

**Entregue:**

- Domínio `services`: CRUD do culto, itens (adicionar música, remover,
  duplicar, mover), com título do item copiado no momento em que entra na
  lista — se a música for renomeada depois, a ordem já preparada continua
  legível com o nome de quando foi montada.
- Coluna do operador ganha a seção "Ordem do culto": clicar num item apresenta
  a música (reusa o comando existente, não é um motor paralelo); setas movem
  para cima/baixo; ícones duplicam e removem.
- Botão "Adicionar" no detalhe da música. Sem culto ativo, o primeiro clique
  cria um com título padrão — a ordem do culto nasce no primeiro "adicionar",
  em vez de exigir um passo de configuração antes.

**Um bug de concorrência SQL, encontrado duas vezes na mesma classe.** O
`UNIQUE (service_id, position)` é verificado linha a linha durante um `UPDATE`,
não só ao final da instrução. Deslocar um intervalo inteiro numa única
instrução (para abrir ou fechar espaço ao mover ou duplicar um item) pode
colidir a meio caminho, dependendo da ordem em que o SQLite decide processar as
linhas.

Apareceu primeiro em `move_item`, pego por teste (verificado quebrando de
propósito). A correção — um salto por uma zona de posições bem negativa antes
de pousar no lugar final, para que nenhuma linha tocada assuma, mesmo por um
instante, um valor que outra já ocupa — resolveu ali.

**Apareceu de novo em `duplicate_item`, mas só ao rodar o aplicativo.** O teste
original usava dois itens, e com uma única linha deslocando nunca há colisão.
Com uma ordem do culto de três músicas montada à mão no app, o "Nao foi
possivel acessar a biblioteca local." apareceu na tela ao duplicar o primeiro
item. Mesma causa, mesma correção. O teste de regressão agora usa três itens —
o número mínimo que expõe a classe de bug — e foi verificado falhando com a
correção revertida antes de ser aceito.

**Verificado rodando o aplicativo:** ordem do culto com três músicas montada
pela interface; apresentar clicando num item da lista; mover, duplicar e
remover, com a projeção continuando a acompanhar a música certa durante todas
essas operações (o destaque "no ar" compara por id de origem, não por posição
na lista — mudar a ordem não pode perder de vista o que está no ar).

| Verificação                                | Resultado                     |
| ------------------------------------------ | ----------------------------- |
| Ordem do culto montada e usada no app real | ✅                            |
| Duplicar com 3+ itens (o bug real)         | ✅ (era ❌ antes da correção) |
| `cargo test` / `pnpm test`                 | 110 / 122                     |
| clippy / eslint / tsc / prettier           | limpos                        |
| Bundle JS                                  | 80,5 kB gzip                  |

## Fase 1, passo 6 — Bíblia

**Entregue:**

- Domínio `bible`: tradução, livro, capítulo, versículo, com esquema próprio
  (`bible_translations` → `bible_books` → `bible_verses`), sem tabela de
  capítulo — capítulo é só um agrupamento, sem metadado próprio.
- Importação por arquivo `.json` (formato documentado em
  [`docs/bible.md`](bible.md)), validada por completo antes de qualquer
  escrita no banco; sigla duplicada rejeitada com mensagem amigável.
- Busca por palavra via FTS5 (`bible_verses_fts`), reusando a mesma lógica de
  `build_match_query` já usada para músicas — movida para um módulo
  compartilhado (`fts.rs`) em vez de duplicada.
- Busca por referência (`João 3:16`, `1 João 3:16-18`, `Salmos 23`), com
  resolução do livro por sigla ou nome, exato ou por prefixo, sem diferenciar
  acento ou caixa.
- Uma caixa de busca só na interface: tenta resolver como referência primeiro,
  cai para busca por palavra se isso falhar — sem seletor de modo.
- Apresentação: cada versículo vira um slide, resolvido de novo a partir do
  banco a cada apresentação (nunca a partir do texto que a interface tem em
  mãos) — a mesma regra de integridade já aplicada às músicas.

**Decisão deliberada: nenhuma tradução vem com o instalador.** O briefing
original pedia uma tradução de domínio público já embutida. Duas razões
pesaram contra: direitos autorais (a maioria das traduções em português é
protegida; "domínio público" de verdade não é algo para decidir sozinho
dentro do código de um projeto de terceiros) e fidelidade do texto (não há
aqui uma forma verificada de baixar e validar um arquivo de tradução antes de
embuti-lo — reproduzir Escritura de memória arrisca errar uma palavra, um
problema mais grave que um typo numa letra). O módulo entrega o mecanismo
inteiro; cada igreja importa a tradução que tem o direito de usar. O
raciocínio completo está em [`docs/bible.md`](bible.md).

**O bug que só apareceu rodando o script de migration.** Um `cargo fmt`
anterior já tinha reformatado o array `MIGRATIONS` para várias linhas, e um
`str.replace()` para acrescentar a migration 3 não encontrou mais o texto
antigo — o script terminou sem erro, mas não alterou o arquivo. Sintoma: os
16 testes novos do repositório da Bíblia falhavam com
`no such table: bible_translations`, mesmo com a migration escrita e correta.
Corrigido lendo o conteúdo atual do arquivo antes de editar, em vez de confiar
num replace "silencioso". Lição que vale para qualquer edição de arquivo por
script: verificar o resultado, não só o código de saída.

**Verificado rodando o aplicativo:** importação de um arquivo `.json` com dois
livros fictícios via o diálogo nativo de arquivo (automatizado sob Xvfb com
`xdotool`, atalho `ctrl+l` do GTK para digitar o caminho); confirmado também
por consulta direta ao `holy-media.db` da instalação que os livros e a
tradução foram persistidos, não só exibidos na tela. Busca por referência
(`Lex 1:2`) resolvendo e destacando o versículo certo; apresentação mostrando
só o texto do versículo na prévia e no rodapé (`Lex 1:2 · 1 de 1`); botões de
avançar/voltar corretamente inertes (`canGoNext`/`canGoPrevious` em `false`)
para uma apresentação de um único versículo.

| Verificação                                                | Resultado    |
| ---------------------------------------------------------- | ------------ |
| Importar tradução via diálogo nativo de arquivo (app real) | ✅           |
| Persistência confirmada por consulta direta ao `.db`       | ✅           |
| Busca por referência resolve e apresenta o versículo certo | ✅           |
| Navegação inerte no limite (1 de 1)                        | ✅           |
| `cargo test`                                               | 145 testes   |
| `pnpm test` (Vitest)                                       | 152 testes   |
| clippy / eslint / tsc / prettier                           | limpos       |
| Bundle JS                                                  | 82,7 kB gzip |

## Próximo passo

**Backgrounds e QR Code** — cor sólida, gradiente e imagem como fundo da
projeção; slide de texto livre; slide de QR Code para PIX de ofertas. Com a
Bíblia entregue, todo bloco de conteúdo previsto para o MVP já existe; o que
falta na Fase 1 é o acabamento da projeção e o `KeyboardShortcutService`.

## Fase 1 — passos restantes

Ordem de execução, escolhida para que cada passo seja demonstrável sozinho:

1. ~~**SQLite no núcleo Rust**~~ — feito.
2. ~~**Domínio de músicas**~~ — feito.
3. ~~**Busca com FTS5**~~ — feito, 11 ms em 5000 músicas.
4. ~~**Presentation Engine**~~ — feito.
5. ~~**Segunda tela**~~ — feito.
6. ~~**Bíblia**~~ — feito.
7. ~~**Ordem do culto**~~ — feito.
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
