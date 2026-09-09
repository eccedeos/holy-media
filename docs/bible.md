# Bíblia

Tradução, livro, capítulo, versículo — com busca por palavra e por referência.
Vive em `apps/desktop/src-tauri/src/bible/`.

## Nenhuma tradução vem com o instalador

Esta é uma decisão deliberada, não um corte de escopo silencioso. O briefing
original pedia uma tradução de domínio público já embutida, para dar para
testar sem nenhum passo extra. Duas razões pesaram contra:

1. **Direitos autorais.** A maioria das traduções em português (ARA, ARC, NVI,
   NTLH...) é protegida. "Domínio público" de verdade, em português, é uma
   lista curta e cheia de ressalvas regionais — não é algo para decidir por
   conta própria dentro do código de um projeto de terceiros.
2. **Fidelidade do texto.** Reproduzir Escritura de memória, ou copiada sem
   verificação linha a linha contra uma fonte confiável, arrisca errar uma
   palavra — um problema mais grave do que um typo numa letra de música.
   Não há aqui uma forma verificada de baixar e validar um arquivo de
   tradução antes de embuti-lo no instalador.

Em vez disso, o módulo entrega o mecanismo inteiro — schema, importação,
navegação, busca, apresentação — sem nenhum versículo real dentro do
repositório. Toda igreja importa a tradução que tem o direito de usar. Os
testes automatizados usam texto claramente fictício ("Texto de exemplo,
versiculo dois, com a palavra aleluia"), nunca Escritura verdadeira, para que
não haja ambiguidade sobre a origem do texto em nenhum arquivo deste projeto.

## Esquema

```
bible_translations ── bible_books ── bible_verses

bible_verses_fts             (índice de busca FTS5)
```

**`bible_translations`** — sigla (`abbreviation`, única, sem diferenciar
maiúsculas/minúsculas), nome, idioma, data de importação.

**`bible_books`** — pertence a uma tradução; `position` é a ordem canônica
(Gênesis = 1, Apocalipse = 66...), usada para desempate ao resolver referências
e para listar os livros na ordem certa; `chapter_count` evita uma consulta
`MAX(chapter)` só para preencher o seletor de capítulo na interface.

**`bible_verses`** — pertence a um livro; `UNIQUE (book_id, chapter, verse)`
impede duplicar um versículo. Não existe uma tabela `bible_chapters`: capítulo
é só um agrupamento de versículos, sem metadado próprio que justifique uma
entidade.

Todas as tabelas são `STRICT`, e `ON DELETE CASCADE` remove livros e
versículos junto com a tradução — exceto o índice FTS5, que o SQLite não
alcança com uma chave estrangeira comum. `delete_translation` limpa o FTS5
explicitamente antes de apagar a tradução, no mesmo padrão já usado para
excluir uma música (`songs::repository::delete`).

Sem migration própria para busca: `bible_verses_fts` reusa o mesmo
`build_match_query` de `songs`, agora em `fts.rs` (compartilhado entre os dois
domínios, movido de `songs/search.rs`) — a lógica de tokenizar e escapar uma
busca do operador é idêntica nos dois casos.

## Formato de importação

Um arquivo `.json` único, com todos os livros e capítulos de uma tradução.
Estrutura mínima:

```json
{
  "abbreviation": "EX",
  "name": "Tradução de Exemplo",
  "language": "pt-BR",
  "books": [
    {
      "name": "Livro Um",
      "abbreviation": "L1",
      "chapters": [
        ["Texto do primeiro versículo.", "Texto do segundo versículo."],
        ["Capítulo dois, versículo um."]
      ]
    }
  ]
}
```

- `chapters` é uma lista de capítulos; cada capítulo é uma lista de
  versículos, na ordem — o número do capítulo e do versículo vem da posição
  na lista, não é digitado no arquivo.
- `chapter_count` do livro é derivado do tamanho de `chapters`; não faz parte
  do arquivo.
- Validado antes de qualquer escrita no banco (`BibleImportInput::validated`):
  sigla e nome dentro de um limite de tamanho e não vazios, ao menos um livro,
  todo livro com nome, sigla e ao menos um capítulo, todo capítulo com ao
  menos um versículo não vazio. Um arquivo que falha a validação não grava
  nada — nem parcialmente.
- Sigla de tradução duplicada é rejeitada com uma mensagem amigável
  ("Já existe uma tradução importada com a sigla..."), não o erro genérico de
  falha de banco.

A interface (`BibleNavigator`) faz upload via `<input type="file">`, lê como
texto e chama `JSON.parse` antes de mandar para o núcleo — um arquivo
malformado é pego ali, com uma mensagem que aponta para este documento, sem
gastar uma chamada IPC.

## Referências e busca: uma caixa só

A caixa de busca da Bíblia não distingue "busca por palavra" de "busca por
referência" com um seletor — ela tenta resolver como referência primeiro
(`resolveBibleReference`) e, se isso falhar por qualquer motivo, cai para
busca por palavra (`searchBible`). O operador digita "João 3:16" ou "amor" na
mesma caixa e recebe o resultado certo para cada caso.

### Gramática da referência

```
<livro> <capítulo>[:<versículo>[-<versículo final>]]
```

Exemplos válidos: `João 3:16`, `1 João 3:16-18`, `Salmos 23` (capítulo
inteiro), `Cântico dos Cânticos 1:1`.

O parser (`bible::reference::parse_reference`) separa livro do resto pelo
**último espaço** (`rsplit_once`), não o primeiro — assim "1 João" e "Cântico
dos Cânticos" continuam sendo o nome do livro inteiro, sem precisar de uma
lista de excepões para livros com números ou múltiplas palavras no nome.
Capítulo ou versículo zero ou negativo é rejeitado; não há uma referência
`Livro 0`.

### Resolução do livro

`resolve_book` casa o texto digitado contra os livros da tradução, em ordem de
prioridade: sigla exata → nome exato → nome com o texto como prefixo → sigla
com o texto como prefixo. A comparação ignora acento e caixa (uma função local
`fold()`, mapeando as letras acentuadas do português para a forma base, sem
puxar uma dependência nova só para isso). Os livros já vêm ordenados por
`position` antes da busca, então um empate entre dois prefixos resolve sempre
para o mesmo livro, de forma determinística.

### Diferença deliberada da busca de músicas

Busca de músicas com a caixa vazia lista os itens usados recentemente — um
atalho útil para "a música que acabei de usar". Busca bíblica com a caixa
vazia devolve uma lista vazia, não "todos os versículos" nem um histórico:
não existe um equivalente sensato a "versículos recentes" aqui, e listar tudo
seria devolver milhares de linhas sem nenhum filtro pedido.

## Apresentação

`presentation_present_bible` resolve a referência **de novo, a partir do
banco**, a cada chamada — nunca aceita o texto do versículo vindo da
interface. Quem decide o que é Escritura é o banco, nunca um payload que a
interface poderia ter alterado (o mesmo raciocínio de segurança de dados já
aplicado à apresentação de músicas).

Cada versículo se torna um slide (`PresentationSlide`), para que o operador
avance e volte versículo a versículo com os mesmos comandos de navegação já
usados para letras de música — a tradução de domínio para slides mora na
camada de comandos (`commands/presentation.rs`), nunca no motor: ele continua
sem saber o que é um livro ou um capítulo, só uma sequência de slides
(ver [`presentation-engine.md`](presentation-engine.md)).

O `source_id` sintético (`bible:<book_id>:<chapter>:<primeiro_versiculo>`)
identifica a apresentação para o destaque "no ar"; a interface compara pelo
`label` de cada slide (`"<sigla> <capítulo>:<versículo>"`), que o motor já
mantém correto durante a navegação, em vez de tentar recalcular o versículo a
partir do `source_id`.

## Limitações conhecidas

- Sem apoio a apócrifos/deuterocanônicos como categoria própria — um livro
  importado é só um livro, sem marcação de cânone.
- Sem comparação entre traduções lado a lado (mostrar duas versões do mesmo
  versículo) — cada apresentação usa uma tradução só.
- O arquivo de importação precisa ser preparado inteiro de uma vez; não há
  importação incremental (adicionar um livro a uma tradução já importada).
