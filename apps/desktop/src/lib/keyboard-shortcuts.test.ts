import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, isTypingTarget, matchAction } from './keyboard-shortcuts';

function evento(
  key: string,
  overrides: Partial<{
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    target: EventTarget | null;
  }> = {},
) {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    target: null,
    ...overrides,
  };
}

describe('matchAction', () => {
  it('reconhece cada atalho padrao', () => {
    expect(matchAction(evento('ArrowRight'), DEFAULT_BINDINGS)).toBe('next');
    expect(matchAction(evento('ArrowLeft'), DEFAULT_BINDINGS)).toBe('previous');
    expect(matchAction(evento('Home'), DEFAULT_BINDINGS)).toBe('first');
    expect(matchAction(evento('End'), DEFAULT_BINDINGS)).toBe('last');
    expect(matchAction(evento('b'), DEFAULT_BINDINGS)).toBe('toggleBlackout');
    expect(matchAction(evento('Escape'), DEFAULT_BINDINGS)).toBe('clear');
  });

  it('tecla sem nenhum atalho ligado devolve null', () => {
    expect(matchAction(evento('q'), DEFAULT_BINDINGS)).toBeNull();
  });

  it('nao diferencia caixa numa letra (Shift+B ainda e tela preta)', () => {
    expect(matchAction(evento('B'), DEFAULT_BINDINGS)).toBe('toggleBlackout');
  });

  it('ctrl, alt ou meta bloqueiam o atalho', () => {
    expect(matchAction(evento('ArrowRight', { ctrlKey: true }), DEFAULT_BINDINGS)).toBeNull();
    expect(matchAction(evento('ArrowRight', { altKey: true }), DEFAULT_BINDINGS)).toBeNull();
    expect(matchAction(evento('ArrowRight', { metaKey: true }), DEFAULT_BINDINGS)).toBeNull();
  });

  it('respeita um mapa de teclas customizado', () => {
    const customizado = { ...DEFAULT_BINDINGS, next: 'n' };
    expect(matchAction(evento('n'), customizado)).toBe('next');
    expect(matchAction(evento('ArrowRight'), customizado)).toBeNull();
  });

  it('ignora o evento quando o foco esta num campo de texto', () => {
    const input = document.createElement('input');
    expect(matchAction(evento('ArrowRight', { target: input }), DEFAULT_BINDINGS)).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it.each(['input', 'textarea', 'select'])('reconhece <%s>', (tag) => {
    expect(isTypingTarget(document.createElement(tag))).toBe(true);
  });

  it('reconhece um elemento contenteditable', () => {
    const div = document.createElement('div');
    // O atributo direto, nao a propriedade `contentEditable` -- jsdom so'
    // reflete a propriedade de volta para o atributo de forma confiavel
    // quando o elemento esta inserido num documento renderizado.
    div.setAttribute('contenteditable', 'true');
    expect(isTypingTarget(div)).toBe(true);
  });

  it('reconhece contenteditable como atributo vazio (a forma mais comum)', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', '');
    expect(isTypingTarget(div)).toBe(true);
  });

  it('um botao ou o corpo da pagina nao contam como digitacao', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
  });

  it('null (sem foco em nada) nao conta como digitacao', () => {
    expect(isTypingTarget(null)).toBe(false);
  });
});
