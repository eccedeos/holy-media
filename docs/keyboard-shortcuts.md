# Atalhos de teclado

`KeyboardShortcutService` do roadmap — hoje um par de arquivos no frontend
(`apps/desktop/src/lib/keyboard-shortcuts.ts`,
`apps/desktop/src/hooks/use-keyboard-shortcuts.ts`), sem contraparte no
núcleo Rust: atalho é decisão de interface, o Rust nunca soube nem precisa
saber que uma tecla foi pressionada.

## O que "centralizado" significa aqui

Antes deste passo, nenhum atalho existia — cada botão só respondia a
clique. `keyboard-shortcuts.ts` é o **único lugar** que sabe qual tecla faz
o quê (o mapa `DEFAULT_BINDINGS`), e `useKeyboardShortcuts` é o **único**
`addEventListener('keydown', ...)` do aplicativo, montado uma vez em `App`.
Sem essa centralização, cada componente que "precisasse" de um atalho
adicionaria o seu próprio listener, e dois atalhos concorrendo pela mesma
tecla em componentes diferentes seria um bug de corrida para descobrir.

## O que "configurável" significa — e o que ainda não significa

O mapa de teclas é dado (`Bindings`, um `Record<ShortcutAction, string>`),
não uma cadeia de `if (event.key === 'ArrowRight')`. O painel "Atalhos" na
coluna do operador deixa o operador reatribuir qualquer ação a outra tecla,
com um passo de captura ("pressione uma tecla...") e recusa de conflito
(duas ações na mesma tecla escolheriam uma das duas em silêncio a cada
aperto, o que confunde mais do que recusar na hora).

**A ligação em si não é persistida ainda.** Mesma situação do monitor de
projeção escolhido (`SelectedMonitor`, em `commands/display.rs`, com o
comentário "não é persistido ainda: a tabela de configurações entra na Fase
4"): reinventar uma forma de guardar isso agora, antes de existir uma tabela
geral de configurações, duplicaria o problema em vez de resolvê-lo. Até lá,
o operador reconfigura ao abrir o aplicativo, se quiser — o padrão já cobre
o uso comum sem nenhum passo extra.

## A regra que importa mais que todas as outras

Um atalho global só funciona **fora de um campo de texto**
(`isTypingTarget`, em `keyboard-shortcuts.ts`): `<input>`, `<textarea>`,
`<select>` ou um elemento `contenteditable`. Sem isso, digitar um espaço na
busca da biblioteca avançaria o slide, e escrever "b" no título de uma
música ligaria a tela preta — um atalho que também dispara enquanto o
operador digita é pior do que não ter atalho.

Também é ignorado qualquer evento com Ctrl, Alt ou Meta pressionados: um
atalho de uma tecla só não pode roubar uma combinação do navegador ou do
sistema operacional (Ctrl+R, Alt+Tab...).

Verificado rodando o aplicativo de verdade: digitar "b b b" na busca da
biblioteca não ligou a tela preta nem uma vez, com uma música no ar durante
o teste.

## Atalhos padrão

| Tecla    | Ação           |
| -------- | -------------- |
| `→`      | Próximo slide  |
| `←`      | Slide anterior |
| `Home`   | Primeiro slide |
| `End`    | Último slide   |
| `B`      | Tela preta     |
| `Escape` | Tirar do ar    |

Escolhidos por já serem familiares a quem usou qualquer apresentador de
slides — setas para navegar, `Home`/`End` para as pontas, `Escape` com o
mesmo sentido de "fechar" que o resto do sistema operacional já usa. `B`
("blackout") é a convenção comum em software de projeção de igreja.

A comparação de tecla ignora caixa (Shift+B aciona o mesmo atalho que "b")
— só letras são sensíveis a isso; teclas nomeadas como `ArrowRight` já têm
uma grafia única.

`Escape` durante a **captura** de uma nova tecla é a única tecla que nunca
pode ser reatribuída: ela sempre cancela a captura em andamento, no mesmo
gesto universal de "sair disto" que qualquer sistema já usa. Tentar
reatribuir a ação "Tirar do ar" de volta para `Escape` continua possível
normalmente — a regra vale só enquanto uma captura está em andamento.

## Por que funciona em qualquer aba de conteúdo

O listener escuta a janela inteira, não um componente de uma aba
específica: o operador pode estar navegando a Bíblia ou digitando um QR
Code e ainda assim apertar a seta para avançar a música que já está no ar,
porque a coluna do operador (e o atalho) não dependem de qual aba de
conteúdo está aberta.
