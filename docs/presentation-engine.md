# Presentation Engine

O pedaço do sistema que não pode falhar ao vivo. Por isso é o mais simples de
todos: **lógica pura**, sem banco, sem DOM, sem Tauri, sem relógio.

Vive em `apps/desktop/src-tauri/src/presentation/`.

## O que ele é

Recebe uma sequência de slides e responde qual deve estar na tela. Só isso.

```
sequência de slides  ──►  [ motor ]  ──►  o que a segunda tela mostra
    + comandos do operador
```

## O que ele deliberadamente não sabe

**O motor não conhece música.** Ele recebe slides já resolvidos. Quem traduz uma
música (ou, depois, um versículo, uma imagem, um QR Code) em slides é a camada
de comandos — `commands/presentation.rs`, o ponto de composição.

Essa fronteira é o que permite acrescentar Bíblia, vídeo ou PowerPoint sem tocar
no motor. Ela também é o que mantém o motor testável por inteiro: os 23 testes
dele rodam em microssegundos porque não há banco nem janela envolvidos.

## Estado

Três coisas, e nada mais:

| Campo         | O que é                        |
| ------------- | ------------------------------ |
| `loaded`      | a sequência carregada, ou nada |
| `index`       | a posição atual                |
| `blacked_out` | se o operador pediu tela preta |

## Saída

```rust
enum Output {
    Idle,                          // nada carregado
    Black,                         // tela preta pedida pelo operador
    Slide { content: String },     // conteúdo no ar
}
```

A janela de projeção faz um `switch` sobre `kind` e renderiza. Ela não consulta
banco, não conhece música e não decide nada — é o que garante que ela seja o
caminho de render mais barato possível.

Repare que `Idle` e `Black` são estados **diferentes**. "Nada carregado" vai
virar a tela de espera na Fase 2; "tela preta" é um pedido explícito do
operador. Confundir os dois faria a tela de espera aparecer quando o operador
quisesse preto.

## Decisões de comportamento

Cada uma vem de como um culto funciona de verdade, e cada uma tem teste.

**A navegação não circula.** Avançar no último slide não volta ao primeiro.
Voltar sozinho para o verso 1 no meio de um culto seria pior do que não fazer
nada.

**Índice fora da faixa é ignorado, não truncado.** Um clique errado não pode
mandar a projeção para o fim da música.

**A tela preta preserva a posição.** O operador apaga a tela, navega até o slide
certo e reacende já no lugar. Isso é o fluxo normal, não um caso raro: é assim
que se troca de música sem a congregação ver a preparação.

**Carregar outra música mantém a tela preta.** Pelo mesmo motivo. Se carregar
reacendesse a tela, a preparação apareceria no telão.

**O rótulo do slide nunca é projetado.** "Refrão" orienta o operador; na tela
seria um erro visível para a igreja inteira. Por isso `label` está no estado,
mas fora de `Output::Slide`.

**Os comandos devolvem se algo mudou.** `next()` no último slide devolve
`false`, e a camada de comandos usa isso para não acordar a janela de projeção à
toa — desperdício que pesa num PC fraco.

## Fonte única da verdade

O motor vive no Rust, e todo mundo é observador dele:

```
                  ┌──────────────┐
                  │    motor     │  (Rust, com mutex)
                  └──────┬───────┘
          evento         │  presentation:state
      ┌─────────────┬────┴────┬──────────────┐
      ▼             ▼         ▼              ▼
 Control Room  Segunda tela  (Fase 3: celular)
```

A store do frontend **não recalcula nada** — nem os limites de navegação. Ela
guarda o último estado que o núcleo mandou. Duplicar a regra criaria uma segunda
verdade, e as duas divergiriam no pior momento possível.

É também o que faz o controle remoto da Fase 3 ser quase de graça: o celular
vira mais um observador do mesmo estado, sem mudança de arquitetura.

## A janela de projeção

A projeção é uma **segunda janela Tauri** (ver
[ADR 0004](adr/0004-segunda-tela-como-janela-tauri.md)), criada sob demanda,
posicionada no monitor escolhido e colocada em tela cheia. Ela:

- renderiza **apenas** o `Output` — sem menus, sem posição, sem título, sem
  marcação de slide, sem cursor;
- é servida pelo mesmo bundle, com o papel decidido de forma **síncrona**: o
  núcleo injeta `window.__HOLY_MEDIA_ROLE__` antes de qualquer script da
  página. Ler o rótulo pela API do Tauri seria assíncrono, e a projeção
  piscaria o Control Room por um quadro — na frente da igreja inteira;
- tem **capability própria**, com `core:event:default` e mais nada. Ela só
  precisa escutar o motor: não abre janelas, não lê arquivos, não decide nada.

O tamanho da letra usa `clamp(1.5rem, 5.5vw, 12rem)`: a mesma música precisa
encher um projetor de 1024×768 e uma TV 4K sem ninguém reconfigurar nada.

Quando o monitor escolhido some — o cabo do projetor cai no meio do culto — o
comando devolve "O monitor escolhido não está mais conectado" em vez de falhar
em silêncio.

## O que ainda não existe

- **Backgrounds.** `Output::Slide` carrega só o texto por enquanto.
- **`set_blackout(bool)` explícito.** Só faz falta com mais de um cliente —
  dois toggles simultâneos se cancelam. Entra na Fase 3, junto com o celular.
- **Ordem do culto.** Hoje o motor carrega uma música por vez.
