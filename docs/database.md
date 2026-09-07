# Banco de dados

SQLite em arquivo único, acessado exclusivamente pelo núcleo Rust. O porquê de
não haver ORM está no [ADR 0002](adr/0002-acesso-a-dados-sqlite-sem-orm.md).

## Onde fica o arquivo

`<diretório de dados da aplicação>/holy-media.db`, resolvido pelo Tauri:

| Sistema | Caminho                                                 |
| ------- | ------------------------------------------------------- |
| Linux   | `~/.local/share/app.holymedia.desktop/holy-media.db`    |
| Windows | `%APPDATA%\app.holymedia.desktop\holy-media.db`         |
| macOS   | `~/Library/Application Support/app.holymedia.desktop/…` |

Um arquivo só. Backup e restauração são cópia de arquivo — que é exatamente o
que uma igreja consegue fazer sem suporte técnico.

## Pragmas de abertura

```sql
PRAGMA journal_mode = WAL;      -- leitura não bloqueia escrita
PRAGMA synchronous = NORMAL;    -- par recomendado do WAL
PRAGMA foreign_keys = ON;       -- sem isto, ON DELETE CASCADE é ignorado
```

`WAL` importa no uso real: o operador busca música enquanto o app grava
histórico, e um não pode travar o outro. `synchronous = NORMAL` sobrevive à
queda do aplicativo; só um corte de energia na tomada poderia custar a última
transação — risco aceitável para uma biblioteca de músicas, em troca de escrita
muito mais rápida em HD mecânico.

`foreign_keys` merece o comentário no código: o SQLite ignora as chaves
estrangeiras **em silêncio** se o pragma estiver desligado, e apagar uma música
deixaria slides órfãos para sempre.

## Migrations

Arquivos `.sql` numerados em `src-tauri/src/db/migrations/`, embutidos no
binário com `include_str!`. A instalação continua sendo um arquivo só, e uma
migration ausente vira erro de compilação em vez de erro no domingo de manhã.

O controle de versão usa `PRAGMA user_version` — um inteiro que o próprio
SQLite guarda no cabeçalho do arquivo. Sem tabela de controle, sem dependência.

Cada migration roda numa transação junto com a atualização da versão: ou a
migration inteira vale, ou o banco fica na versão anterior. Um banco meio
migrado seria pior do que um banco antigo.

> **Nunca edite uma migration já publicada.** Um banco existente não a
> executaria de novo, e as duas instalações divergiriam em silêncio. Adicione a
> próxima no fim.

## Convenções

| Convenção      | Escolha                       | Por quê                                                                                         |
| -------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| Chave primária | `TEXT` com UUID v7            | único entre máquinas (sincronização, Fase 5); ordenado no tempo, o que mantém o índice compacto |
| Datas          | `INTEGER` em ms desde a epoca | sem biblioteca de data no Rust; `new Date(ms)` no TS                                            |
| Booleano       | `INTEGER` 0/1 com `CHECK`     | é como o SQLite representa                                                                      |
| Tabelas        | `STRICT`                      | o SQLite aceitaria texto numa coluna `INTEGER` sem reclamar; `STRICT` transforma isso em erro   |

Toda entidade nasce com `created_at` e `updated_at` — não porque a tela precise
hoje, mas porque sincronização sem eles é impossível de adicionar depois.

## Esquema atual (migration 0001)

```
songs ──┬── song_slides    (letra dividida em blocos de projeção)
        ├── song_tags ──── tags
        └── song_usages    (histórico: "usadas recentemente")

songs_fts                  (índice de busca FTS5)
```

**`songs`** — título, artista, autor, categoria, favorito, datas.

**`song_slides`** — `position` é a ordem de projeção (base zero); `label` é a
marcação que o operador lê ("Verso 1", "Refrão"). `UNIQUE (song_id, position)`
impede duas letras na mesma posição.

**`tags`** — `name` é `UNIQUE COLLATE NOCASE`, então "Natal" e "natal"
convergem para a mesma linha em vez de duplicarem a tag na biblioteca.

**`song_usages`** — uma linha por uso. Alimenta "usadas recentemente" sem
varrer nada.

## Busca (FTS5)

```sql
CREATE VIRTUAL TABLE songs_fts USING fts5 (
    song_id UNINDEXED, title, artist, author, lyrics, tags,
    tokenize = "unicode61 remove_diacritics 2"
);
```

**`remove_diacritics 2` é o detalhe que muda o uso real.** O operador digita
"coracao" com pressa e precisa encontrar "Coração". Funciona nos dois sentidos,
e há teste cobrindo ambos.

O índice **não** é `external content`: a letra indexada é a concatenação dos
slides, que não existe como coluna em lugar nenhum. Quem mantém a sincronia é a
função `reindex` do repositório, chamada depois de toda escrita. Esse é o bug
mais provável do módulo — uma música que existe mas não aparece na busca — e por
isso há teste cobrindo criação, edição e exclusão.

### Como o texto digitado vira consulta

O texto **nunca** é concatenado no `MATCH`. A sintaxe do FTS5 tem operadores
próprios (`AND`, `OR`, `NOT`, `NEAR`, aspas, parênteses, `*`, `^`, `:`), e um
`MATCH` inválido não devolve zero resultados — ele **estoura um erro**. Alguém
buscando `grande e' o senhor`, com apóstrofo, veria a busca quebrar no culto.

`songs::search::build_match_query` extrai só os termos alfanuméricos e reescreve
a consulta do zero, com cada termo entre aspas (literal) e o último com `*`
(prefixo, para filtrar enquanto se digita).

### Ranking

`bm25(songs_fts, 0.0, 10.0, 5.0, 3.0, 1.0, 2.0)` — título pesa mais que artista,
que pesa mais que letra. Quem digita "aleluia" quase sempre procura a música
_chamada_ "Aleluia", não toda música com "aleluia" no refrão. A letra continua
encontrando; só não ganha do título. Há teste para isso.

### Performance medida

Biblioteca de 5000 músicas, termo presente em todas (pior caso do ranking):

| Build   | Tempo     | Orçamento |
| ------- | --------- | --------- |
| release | **11 ms** | 50 ms     |
| debug   | 24 ms     | —         |

O teste `busca_em_biblioteca_grande_continua_rapida` mantém isso honesto. O
limite dele é folgado (250 ms) porque roda em debug e em CI compartilhada; o que
ele protege é a ordem de grandeza — se alguém trocar o FTS5 por
`LIKE '%…%'`, ele quebra.

## Limite de resultados

`SEARCH_LIMIT = 100`. Sem teto, uma busca por "a" numa biblioteca grande
atravessaria o IPC inteira — desperdício de memória, e o operador não lê cem
linhas de qualquer forma: ele refina a busca.

Pelo mesmo motivo existem dois formatos: `SongSummary` (listas) e `Song`
(detalhe, com a letra completa). Mandar a letra de mil músicas só para desenhar
títulos seria caro à toa.
