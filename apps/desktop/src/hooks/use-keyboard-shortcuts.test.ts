import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PresentationState } from '@holy-media/types';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { resetPresentationStore } from '@/store/presentation-store';
import {
  resetKeyboardShortcutsStore,
  useKeyboardShortcutsStore,
} from '@/store/keyboard-shortcuts-store';
import * as api from '@/lib/presentation-api';

vi.mock('@/lib/presentation-api');

function estado(overrides: Partial<PresentationState> = {}): PresentationState {
  return {
    output: { kind: 'slide', content: 'Primeira estrofe' },
    sourceId: 'musica-1',
    title: 'Grande e o Senhor',
    label: 'Verso 1',
    index: 0,
    total: 4,
    blackedOut: false,
    canGoNext: true,
    canGoPrevious: true,
    ...overrides,
  };
}

function dispara(
  key: string,
  target: EventTarget = window,
  overrides: Partial<KeyboardEvent> = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...overrides,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.resetAllMocks();
  resetPresentationStore();
  resetKeyboardShortcutsStore();
});

describe('useKeyboardShortcuts', () => {
  it('seta direita avanca o slide', () => {
    vi.mocked(api.presentationNext).mockResolvedValue(estado({ index: 1 }));
    renderHook(() => useKeyboardShortcuts());

    act(() => dispara('ArrowRight'));

    expect(api.presentationNext).toHaveBeenCalled();
  });

  it('seta esquerda volta o slide', () => {
    vi.mocked(api.presentationPrevious).mockResolvedValue(estado());
    renderHook(() => useKeyboardShortcuts());

    act(() => dispara('ArrowLeft'));

    expect(api.presentationPrevious).toHaveBeenCalled();
  });

  it('b liga a tela preta', () => {
    vi.mocked(api.presentationToggleBlackout).mockResolvedValue(estado({ blackedOut: true }));
    renderHook(() => useKeyboardShortcuts());

    act(() => dispara('b'));

    expect(api.presentationToggleBlackout).toHaveBeenCalled();
  });

  it('Escape tira do ar', () => {
    vi.mocked(api.presentationClear).mockResolvedValue(
      estado({ output: { kind: 'idle' }, total: 0 }),
    );
    renderHook(() => useKeyboardShortcuts());

    act(() => dispara('Escape'));

    expect(api.presentationClear).toHaveBeenCalled();
  });

  it('nao dispara nada com o foco num campo de texto', () => {
    renderHook(() => useKeyboardShortcuts());
    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => dispara('ArrowRight', input));

    expect(api.presentationNext).not.toHaveBeenCalled();
    input.remove();
  });

  it('tecla sem atalho ligado nao chama nenhum comando', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => dispara('q'));

    expect(api.presentationNext).not.toHaveBeenCalled();
    expect(api.presentationPrevious).not.toHaveBeenCalled();
  });

  it('durante a captura de uma nova tecla, o atalho normal nao dispara', () => {
    vi.mocked(api.presentationNext).mockResolvedValue(estado({ index: 1 }));
    renderHook(() => useKeyboardShortcuts());

    act(() => useKeyboardShortcutsStore.getState().startCapture('previous'));
    // "p" nao e' tecla padrao de nenhum atalho -- so' assim a captura em si
    // e' o que este teste teria que exercitar, sem tropecar num conflito de
    // tecla (que e' testado a parte na store).
    act(() => dispara('p'));

    // A tecla foi capturada para "previous" (religando-o), nao usada para
    // avancar o slide que estava no ar -- "p" nao aciona nada por padrao.
    expect(api.presentationNext).not.toHaveBeenCalled();
    expect(useKeyboardShortcutsStore.getState().bindings.previous).toBe('p');
  });

  it('Escape durante a captura cancela em vez de virar a tecla do atalho', () => {
    renderHook(() => useKeyboardShortcuts());

    act(() => useKeyboardShortcutsStore.getState().startCapture('previous'));
    act(() => dispara('Escape'));

    expect(useKeyboardShortcutsStore.getState().capturing).toBeNull();
    expect(api.presentationClear).not.toHaveBeenCalled();
  });

  it('desliga o listener ao desmontar', () => {
    vi.mocked(api.presentationNext).mockResolvedValue(estado());
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();

    act(() => dispara('ArrowRight'));

    expect(api.presentationNext).not.toHaveBeenCalled();
  });

  it('usa a ligacao customizada em vez da tecla padrao', () => {
    vi.mocked(api.presentationNext).mockResolvedValue(estado({ index: 1 }));
    useKeyboardShortcutsStore.getState().bind('next', 'n');
    renderHook(() => useKeyboardShortcuts());

    act(() => dispara('ArrowRight'));
    expect(api.presentationNext).not.toHaveBeenCalled();

    act(() => dispara('n'));
    expect(api.presentationNext).toHaveBeenCalled();
  });
});
