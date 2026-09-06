# ADR 0002 — SQLite acessado do Rust, sem ORM

**Status:** Aceito · Fase 0 (implementação na Fase 1)

## Contexto

O briefing pedia "Prisma, Drizzle ou outra alternativa adequada ao ambiente
Tauri" e pedia explicitamente que a escolha fosse analisada antes de fechada.
Esta é a decisão de dados do projeto, e reverter depois significaria reescrever
todo o acesso a banco.

O contexto real: aplicação Tauri, banco SQLite local, PC de referência com 4 GB
de RAM, e um requisito de busca abaixo de 50 ms numa biblioteca de milhares de
músicas.

## Alternativas avaliadas

**Prisma.** Descartado. O Prisma carrega um query engine nativo de dezenas de
megabytes e opera a partir do Node.js. Dentro do Tauri não há Node.js: existe um
WebView e um binário Rust. Encaixá-lo significaria embutir um runtime Node
inteiro no instalador — exatamente o custo que motivou escolher Tauri em vez de
Electron.

**Drizzle no frontend.** Descartado. Drizzle é excelente, mas roda em
JavaScript, e o WebView não tem acesso ao sistema de arquivos. O banco vive do
lado Rust; colocar o ORM do lado errado da fronteira significaria trafegar dados
por IPC só para montar consultas.

**Drizzle via `sqlite-proxy` + `tauri-plugin-sql`.** Tecnicamente funciona:
Drizzle monta o SQL no TypeScript e um driver-proxy o envia ao Rust, que executa
com SQLx. Descartado assim mesmo — cada consulta atravessa a fronteira IPC duas
vezes (SQL para lá, linhas para cá), e a tipagem que o ORM oferece já é obtida
pelos comandos Tauri tipados. Paga-se latência e complexidade por uma
conveniência que não se materializa aqui.

**SQL direto em Rust, com `rusqlite`.** Escolhido.

## Decisão

O banco é acessado exclusivamente pelo núcleo Rust, com `rusqlite` (SQLite
embutido, sem dependência do sistema) e SQL escrito à mão. A interface nunca fala
com o banco: ela chama comandos Tauri tipados, e cada comando devolve uma struct
que tem espelho em `@holy-media/types`.

Migrations são arquivos `.sql` versionados, aplicados na inicialização.

## Por quê

**Peso.** É a razão principal. `rusqlite` com SQLite embutido adiciona poucas
centenas de kB ao binário. Nenhuma das alternativas chega perto disso.

**FTS5.** O requisito de busca instantânea é atendido pelo full-text search que
já vem dentro do SQLite — sem índice externo, sem processo de indexação em
background, sem carregar a biblioteca inteira na memória para filtrar. Nenhum ORM
expõe FTS5 bem; todos exigiriam SQL cru justamente na consulta mais crítica do
sistema. Se o caminho quente vai ser SQL de qualquer forma, o ORM está pagando
custo sem cobrir o caso que importa.

**Controle.** Consultas de projeção precisam ser previsíveis. SQL explícito é
lido, medido e otimizado; SQL gerado precisa primeiro ser descoberto.

**A tipagem não se perde.** É o argumento mais forte a favor de um ORM, e aqui
ele não se aplica: a fronteira já é tipada pelos comandos Tauri e pelos
contratos compartilhados. O ORM ofereceria tipagem _dentro_ do Rust, onde o
compilador já é rigoroso.

## Consequências

- Escrever SQL à mão é mais verboso. Aceito: o volume de consultas de um app de
  projeção é modesto e bem delimitado.
- Migrations são responsabilidade nossa. Ficam em `.sql` versionado — o formato
  mais simples de auditar e de reverter.
- Backup e restauração viram cópia de um arquivo.
- Se o modelo crescer a ponto de o SQL manual pesar, `sqlx` (com verificação de
  consultas em tempo de compilação) é o próximo passo natural, sem trocar de
  paradigma.

## O que isso não impede

A Fase 5 prevê PostgreSQL no servidor de sincronização. Ele é outro processo,
com outra stack, e nada aqui o restringe.
