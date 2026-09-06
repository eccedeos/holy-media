# ADR 0004 — Segunda tela é uma segunda janela Tauri

**Status:** Aceito · Fase 0 (implementação na Fase 1)

## Contexto

O software precisa exibir conteúdo num projetor ou TV enquanto o operador
trabalha noutro monitor. A janela de projeção é o que a congregação vê: ela não
pode piscar, travar ou mostrar um menu por engano.

## Alternativas avaliadas

**Um `<div>` em tela cheia na mesma janela.** Descartado: não funciona em dois
monitores de verdade, e qualquer erro de render no Control Room levaria a
projeção junto.

**Um segundo processo do aplicativo.** Descartado: dobra o consumo de memória —
dois WebViews, dois runtimes — e cria um problema de sincronização entre
processos. Contra um orçamento de 250 MB projetando, é caro demais.

**Uma segunda janela (`WebviewWindow`) no mesmo processo.** Escolhido.

## Decisão

A projeção é uma segunda janela Tauri, criada sob demanda, posicionada no
monitor escolhido e colocada em tela cheia. Ela:

- renderiza **apenas** conteúdo — sem menus, sem controles, sem cursor;
- recebe eventos do núcleo Rust, que é a fonte única da verdade;
- não compartilha estado de UI com o Control Room;
- sobrevive a um erro do Control Room, e vice-versa.

Quando não há segundo monitor, o app degrada para uma janela normal em vez de
falhar — em ensaio e em configuração isso é o comportamento útil.

## Por quê

**Isolamento sem duplicar custo.** Duas janelas no mesmo processo compartilham o
runtime Rust e o WebView, mas têm árvores de render independentes. Um erro numa
não derruba a outra — que é exatamente a garantia que se quer sobre a tela que a
congregação está olhando.

**O estado vive no Rust.** O Presentation Engine é a fonte da verdade; as duas
janelas são observadoras. Isso significa que, na Fase 3, o celular vira mais um
observador do mesmo estado, sem nenhuma mudança de arquitetura.

**Multi-monitor é problema do sistema operacional, e ele resolve melhor.** O
Tauri expõe `available_monitors()`; posicionar e ir para fullscreen é chamada de
API, não gambiarra de CSS.

## Consequências

- É preciso lidar com o monitor que desaparece (cabo solto no meio do culto). O
  módulo `display` trata isso explicitamente, com fallback e log.
- A janela de projeção precisa de um caminho de render mínimo: menos componentes,
  nenhuma animação sem propósito, nenhuma dependência que não seja essencial.
- Tela preta e tela de espera são estados do motor, não truques de CSS — assim o
  celular consegue disparar e refletir esses estados.
