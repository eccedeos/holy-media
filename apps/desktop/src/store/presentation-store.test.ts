import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PresentationState } from '@holy-media/types';
import { resetPresentationStore, usePresentationStore } from './presentation-store';
import { createAppError } from '@/lib/ipc';
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
    canGoPrevious: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetPresentationStore();
});

describe('estado inicial', () => {
  it('comeca sem nada no ar', () => {
    expect(usePresentationStore.getState().state.output).toEqual({ kind: 'idle' });
    expect(usePresentationStore.getState().state.total).toBe(0);
  });
});

describe('comandos', () => {
  it('guarda o estado devolvido pelo nucleo', async () => {
    vi.mocked(api.presentSong).mockResolvedValue(estado());

    await usePresentationStore.getState().present('musica-1');

    expect(api.presentSong).toHaveBeenCalledWith('musica-1');
    expect(usePresentationStore.getState().state.title).toBe('Grande e o Senhor');
  });

  it('nao recalcula os limites: usa os que o nucleo mandou', async () => {
    // O motor no Rust e' a unica fonte da verdade. Se a store refizesse a
    // conta, haveria duas regras para manter em sincronia.
    vi.mocked(api.presentationLast).mockResolvedValue(
      estado({ index: 3, canGoNext: false, canGoPrevious: true }),
    );

    await usePresentationStore.getState().last();

    const { state } = usePresentationStore.getState();
    expect(state.canGoNext).toBe(false);
    expect(state.canGoPrevious).toBe(true);
  });

  it('reflete a tela preta sem perder a posicao', async () => {
    vi.mocked(api.presentationToggleBlackout).mockResolvedValue(
      estado({ output: { kind: 'black' }, blackedOut: true, index: 2, label: 'Verso 2' }),
    );

    await usePresentationStore.getState().toggleBlackout();

    const { state } = usePresentationStore.getState();
    expect(state.output).toEqual({ kind: 'black' });
    // O operador continua sabendo onde esta, mesmo com a tela apagada.
    expect(state.index).toBe(2);
    expect(state.label).toBe('Verso 2');
  });

  it('guarda o erro do nucleo sem apagar o que estava no ar', async () => {
    vi.mocked(api.presentSong).mockResolvedValue(estado());
    await usePresentationStore.getState().present('musica-1');

    vi.mocked(api.presentationNext).mockRejectedValue(
      createAppError('IPC_FAILED', 'canal fechado'),
    );
    await usePresentationStore.getState().next();

    const { state, error } = usePresentationStore.getState();
    expect(error?.code).toBe('IPC_FAILED');
    // Uma falha de comando nao pode apagar a projecao em andamento.
    expect(state.title).toBe('Grande e o Senhor');
  });
});

describe('conexao com o nucleo', () => {
  it('aplica o estado que chega pelo evento', async () => {
    let emitir: ((state: PresentationState) => void) | undefined;
    vi.mocked(api.onPresentationState).mockImplementation((handler) => {
      emitir = handler;
      return Promise.resolve(() => {});
    });
    vi.mocked(api.fetchPresentationState).mockResolvedValue(estado({ total: 0 }));

    await usePresentationStore.getState().connect();
    emitir?.(estado({ index: 2, label: 'Verso 2' }));

    expect(usePresentationStore.getState().state.index).toBe(2);
  });

  it('devolve o cancelamento da assinatura', async () => {
    const unlisten = vi.fn();
    vi.mocked(api.onPresentationState).mockResolvedValue(unlisten);
    vi.mocked(api.fetchPresentationState).mockResolvedValue(estado());

    const cancelar = await usePresentationStore.getState().connect();
    cancelar();

    expect(unlisten).toHaveBeenCalled();
  });

  it('nao alarma o operador quando o nucleo nao responde', async () => {
    vi.mocked(api.onPresentationState).mockResolvedValue(() => {});
    vi.mocked(api.fetchPresentationState).mockRejectedValue(
      createAppError('IPC_UNAVAILABLE', 'fora do Tauri'),
    );

    await usePresentationStore.getState().connect();

    // Rodando no navegador nao ha nucleo, e nao ha nada que o operador possa
    // fazer a respeito: a tela fica em espera, sem erro na cara.
    expect(usePresentationStore.getState().error).toBeNull();
    expect(usePresentationStore.getState().state.output).toEqual({ kind: 'idle' });
  });
});
