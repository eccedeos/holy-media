/**
 * Atalhos de teclado da projeção -- lógica pura, sem DOM real.
 *
 * "Centralizado" (seção do roadmap) significa que **este arquivo** é o único
 * lugar que sabe qual tecla faz o quê. Antes disto, nenhum atalho existia:
 * cada botão só respondia a clique. `useKeyboardShortcuts` (o hook que usa
 * este arquivo) é o único ponto que escuta `keydown` na janela inteira.
 *
 * "Configurável" significa que a tecla de cada ação é dado (`Bindings`), não
 * um `if (event.key === 'ArrowRight')` espalhado pelo código -- trocar uma
 * tecla é editar o mapa, não caçar o handler certo. As ligações em si ainda
 * não são persistidas: igual à escolha de monitor (`SelectedMonitor`, em
 * `commands/display.rs`), fica em memória até existir uma tabela geral de
 * configurações (Fase 4) -- reinventar isso só para atalhos, antes da tabela
 * de verdade, duplicaria o problema em vez de resolvê-lo.
 */

/** As acoes que um atalho pode disparar. Todas ja existem como acoes da
 * `presentation-store`; este modulo so decide qual tecla chama qual. */
export type ShortcutAction = 'next' | 'previous' | 'first' | 'last' | 'toggleBlackout' | 'clear';

export type Bindings = Readonly<Record<ShortcutAction, string>>;

/** Rotulo em portugues, para mostrar ao operador -- nunca a acao (`next`) crua. */
export const ACTION_LABELS: Readonly<Record<ShortcutAction, string>> = {
  next: 'Proximo slide',
  previous: 'Slide anterior',
  first: 'Primeiro slide',
  last: 'Ultimo slide',
  toggleBlackout: 'Tela preta',
  clear: 'Tirar do ar',
};

/**
 * Ordem fixa de exibicao (um `Record` não garante ordem estável entre
 * navegadores/motores ao iterar `Object.keys`).
 */
export const ACTION_ORDER: readonly ShortcutAction[] = [
  'next',
  'previous',
  'first',
  'last',
  'toggleBlackout',
  'clear',
];

/**
 * Padrao pensado para quem já usou qualquer apresentador de slides: seta e
 * espaço avançam, seta esquerda volta, Home/End vão às pontas, B é o
 * convencional para "blackout" em software de projeção de igreja, Escape
 * tira do ar (mesmo gesto de "fechar" que o resto do sistema operacional usa).
 */
export const DEFAULT_BINDINGS: Bindings = {
  next: 'ArrowRight',
  previous: 'ArrowLeft',
  first: 'Home',
  last: 'End',
  toggleBlackout: 'b',
  clear: 'Escape',
};

/**
 * `true` quando o evento deveria ser ignorado porque o foco está num campo
 * de texto (ou equivalente).
 *
 * Esta é a regra mais importante do arquivo: sem ela, digitar um espaço na
 * busca da biblioteca avançaria o slide, e "b" no campo de título de uma
 * música ligaria a tela preta -- um atalho global que também dispara
 * enquanto o operador digita é pior que não ter atalho.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

  // O atributo, nao a propriedade `isContentEditable` -- ela depende do
  // elemento estar de fato inserido num documento renderizado para o
  // navegador calcular a herana da arvore, o que a torna instavel em teste.
  // O atributo sozinho ja cobre o caso real (nenhum componente daqui usa
  // `contenteditable="inherit"`).
  const editable = target.getAttribute('contenteditable');
  return editable === '' || editable === 'true';
}

/** Só teclas sozinhas contam: um atalho global não pode roubar Ctrl/Alt/Meta
 * de combinações do navegador ou do sistema operacional. */
function hasModifier(event: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey'>): boolean {
  return event.ctrlKey || event.altKey || event.metaKey;
}

/**
 * Decide qual ação (se alguma) um evento de teclado dispara.
 *
 * Pura de propósito: recebe só os campos do evento que importam, para o
 * teste não precisar simular um `KeyboardEvent` de verdade nem montar DOM.
 */
export function matchAction(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>,
  bindings: Bindings,
): ShortcutAction | null {
  if (hasModifier(event)) return null;
  if (isTypingTarget(event.target)) return null;

  // Comparação sem diferenciar caixa: Shift+B (ou Caps Lock ligado) deve
  // continuar acionando o mesmo atalho que "b" -- letras são a única tecla
  // sensível a isso, mas comparar assim não muda nada para "ArrowRight",
  // "Home" etc., que já têm uma grafia única.
  const tecla = event.key.toLowerCase();
  const acao = ACTION_ORDER.find((candidate) => bindings[candidate].toLowerCase() === tecla);
  return acao ?? null;
}
