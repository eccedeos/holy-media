import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '@/lib/keyboard-shortcuts';
import { resetKeyboardShortcutsStore, useKeyboardShortcutsStore } from './keyboard-shortcuts-store';

beforeEach(() => {
  resetKeyboardShortcutsStore();
});

describe('estado inicial', () => {
  it('comeca com as ligacoes padrao', () => {
    expect(useKeyboardShortcutsStore.getState().bindings).toEqual(DEFAULT_BINDINGS);
    expect(useKeyboardShortcutsStore.getState().capturing).toBeNull();
  });
});

describe('startCapture / cancelCapture', () => {
  it('marca qual acao esta capturando', () => {
    useKeyboardShortcutsStore.getState().startCapture('next');
    expect(useKeyboardShortcutsStore.getState().capturing).toBe('next');
  });

  it('cancelar limpa a captura sem mudar a ligacao', () => {
    useKeyboardShortcutsStore.getState().startCapture('next');
    useKeyboardShortcutsStore.getState().cancelCapture();

    expect(useKeyboardShortcutsStore.getState().capturing).toBeNull();
    expect(useKeyboardShortcutsStore.getState().bindings.next).toBe(DEFAULT_BINDINGS.next);
  });
});

describe('bind', () => {
  it('troca a tecla de uma acao e termina a captura', () => {
    useKeyboardShortcutsStore.getState().startCapture('next');
    useKeyboardShortcutsStore.getState().bind('next', 'n');

    const { bindings, capturing, error } = useKeyboardShortcutsStore.getState();
    expect(bindings.next).toBe('n');
    expect(capturing).toBeNull();
    expect(error).toBeNull();
  });

  it('nao muda as outras ligacoes', () => {
    useKeyboardShortcutsStore.getState().bind('next', 'n');
    expect(useKeyboardShortcutsStore.getState().bindings.previous).toBe(DEFAULT_BINDINGS.previous);
  });

  it('recusa uma tecla ja usada por outro atalho', () => {
    // "ArrowLeft" ja e' o atalho de "previous" -- ligar "next" a ela criaria
    // uma tecla que dispara duas acoes ao mesmo tempo.
    useKeyboardShortcutsStore.getState().bind('next', 'ArrowLeft');

    const { bindings, error } = useKeyboardShortcutsStore.getState();
    expect(bindings.next).toBe(DEFAULT_BINDINGS.next);
    expect(error).not.toBeNull();
  });

  it('a comparacao de tecla em uso ignora caixa', () => {
    useKeyboardShortcutsStore.getState().bind('previous', 'B');
    expect(useKeyboardShortcutsStore.getState().error).not.toBeNull();
  });

  it('religar a mesma acao a mesma tecla que ja tinha nao e um conflito', () => {
    useKeyboardShortcutsStore.getState().bind('toggleBlackout', DEFAULT_BINDINGS.toggleBlackout);
    expect(useKeyboardShortcutsStore.getState().error).toBeNull();
  });
});

describe('resetToDefaults', () => {
  it('volta todas as ligacoes ao padrao', () => {
    useKeyboardShortcutsStore.getState().bind('next', 'n');
    useKeyboardShortcutsStore.getState().resetToDefaults();

    expect(useKeyboardShortcutsStore.getState().bindings).toEqual(DEFAULT_BINDINGS);
  });
});
