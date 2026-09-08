# Ordem do culto

A playlist que amarra itens (hoje, músicas; depois, versículos e outros tipos)
numa sequência — a seção 12 do briefing original. Vive em
`apps/desktop/src-tauri/src/services/`.

## O que ela é, e o que ela não é

A ordem do culto **não é um segundo motor de apresentação**. Ela decide _o
que_ apresentar em seguida; quem apresenta continua sendo o
[Presentation Engine](presentation-engine.md). Clicar num item da lista chama
o mesmo comando que a biblioteca de músicas usa para apresentar — não existe
um caminho paralelo.

Essa fronteira é o motivo de o destaque "no ar" comparar por **id de origem**
(`sourceId` do motor contra `referenceId` do item), não por posição na lista:
mover, duplicar ou remover itens não pode fazer o Control Room perder de vista
o que está realmente sendo projetado.

## Esquema

```
services ──── service_items
```

**`services`** — título, datas.

**`service_items`** — `position` é a ordem de execução (base zero); `kind` é o
tipo do item (hoje só `song`, mas é `TEXT` com `CHECK`, não um enum fechado do
SQLite, para os próximos tipos não exigirem migration de esquema); `title` é
**copiado** no momento em que o item entra na lista.

O título copiado é deliberado: se o operador renomear a música depois, a ordem
do culto já preparada para o domingo continua legível com o nome de quando foi
montada. Buscar o título ao vivo pareceria mais "correto", mas quebraria o
registro histórico do que foi de fato usado naquele culto.

## Operações

Todas em `services::repository`, cada uma numa transação:

| Operação                       | O que faz                                                  |
| ------------------------------ | ---------------------------------------------------------- |
| `create` / `rename` / `delete` | CRUD do culto                                              |
| `add_song`                     | acrescenta ao fim, copiando o título atual                 |
| `remove_item`                  | remove e **reempacota** as posições dos que ficaram depois |
| `duplicate_item`               | insere a cópia logo depois do original, não no fim         |
| `move_item`                    | reordena, com índice fora da faixa recusado, não truncado  |

`remove_item` reempacota porque um buraco na sequência (posições 0, 1, 3, 4)
não afeta a correção, mas deixa o dado inconsistente para depurar depois — e a
lista pequena de um culto (dezenas de itens, nunca milhares) torna ler-e-regravar
em Rust mais claro do que uma consulta SQL elaborada para evitar isso.

## O bug de concorrência, encontrado duas vezes

O `UNIQUE (service_id, position)` é verificado **linha a linha durante um
`UPDATE`**, não só ao final da instrução. Deslocar um intervalo inteiro numa
única instrução — para abrir espaço ao duplicar, ou para reordenar ao mover —
pode colidir a meio caminho, dependendo da ordem em que o SQLite decide
processar as linhas internamente.

Apareceu primeiro em `move_item`, pego por teste. Apareceu de novo em
`duplicate_item`, mas só **rodando o aplicativo**: o teste original usava dois
itens, e com uma única linha deslocando nunca há colisão — são necessários
três ou mais para expor a classe de bug.

A correção, nos dois lugares, é a mesma técnica:

1. Desloca as linhas afetadas para um intervalo de posições **bem negativo**,
   fora de `[0, total)` — não colide com nenhuma linha não tocada, e as
   distâncias relativas entre as linhas tocadas garantem que também não
   colidem entre si, em qualquer ordem de processamento.
2. Traz cada linha de volta para o valor final, numa segunda instrução.

Nenhuma linha tocada jamais assume, mesmo que só por um instante, um valor que
outra linha já ocupa — o que torna o resultado correto independente de como o
SQLite decide processar as linhas por dentro.

```rust
let offset = total + 1; // margem suficiente para nunca sobrepor [0, total)

// 1. afasta para a zona negativa
tx.execute("UPDATE ... SET position = position + 1 - ?offset WHERE ...")?;
// 2. traz de volta
tx.execute("UPDATE ... SET position = position + ?offset WHERE position < 0")?;
```

Os testes de regressão para os dois casos usam o número mínimo de itens que
expõe o problema (três), e cada correção foi verificada falhando com a
mudança revertida antes de ser aceita.

## Interface

- **Adicionar** — botão no detalhe da música. Sem culto ativo, o primeiro
  clique cria um com título padrão ("Ordem do culto"): a ordem do culto nasce
  no primeiro "adicionar" em vez de exigir um passo de configuração antes.
- **Apresentar** — clicar no item.
- **Reordenar** — setas para cima/baixo (não arrastar-e-soltar; mais simples de
  implementar e de testar, e igualmente rápido para uma lista de dezenas de
  itens).
- **Duplicar / remover** — ícones por item.

## O que ainda não existe

- Persistir qual culto está "ativo" entre uma abertura e outra do aplicativo.
- Itens de tipo diferente de música (Bíblia, texto, QR Code) — a coluna `kind`
  já está pronta para eles.
- Reordenar por arrastar-e-soltar.
