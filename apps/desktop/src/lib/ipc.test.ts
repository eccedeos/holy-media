import { afterEach, describe, expect, it } from 'vitest';
import {
  createAppError,
  describeUnknown,
  invokeCommand,
  isAppError,
  isTauriAvailable,
} from './ipc';

const TAURI_KEY = '__TAURI_INTERNALS__';

function pretendTauriIsPresent() {
  (window as unknown as Record<string, unknown>)[TAURI_KEY] = {};
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[TAURI_KEY];
});

describe('isTauriAvailable', () => {
  it('e falso no navegador puro', () => {
    expect(isTauriAvailable()).toBe(false);
  });

  it('e verdadeiro dentro da janela Tauri', () => {
    pretendTauriIsPresent();
    expect(isTauriAvailable()).toBe(true);
  });
});

describe('describeUnknown', () => {
  it('devolve a propria string', () => {
    expect(describeUnknown('falha no banco')).toBe('falha no banco');
  });

  it('extrai a mensagem de um Error', () => {
    expect(describeUnknown(new Error('monitor ausente'))).toBe('monitor ausente');
  });

  it('serializa objetos', () => {
    expect(describeUnknown({ code: 7 })).toBe('{"code":7}');
  });
});

describe('createAppError', () => {
  it('usa a mensagem amigavel do codigo', () => {
    const error = createAppError('IPC_FAILED');
    expect(error.message).toBe('Nao foi possivel se comunicar com o nucleo do aplicativo.');
    expect(error.detail).toBeUndefined();
  });

  it('guarda o detalhe tecnico separado da mensagem', () => {
    const error = createAppError('IPC_FAILED', 'thread panicked at src/lib.rs:42');
    expect(error.detail).toBe('thread panicked at src/lib.rs:42');
    expect(error.message).not.toContain('panicked');
  });

  it('e reconhecido por isAppError', () => {
    expect(isAppError(createAppError('UNKNOWN'))).toBe(true);
    expect(isAppError(new Error('cru'))).toBe(false);
  });
});

describe('invokeCommand', () => {
  it('rejeita com IPC_UNAVAILABLE fora do Tauri, sem estourar excecao crua', async () => {
    await expect(invokeCommand('app_info')).rejects.toMatchObject({
      code: 'IPC_UNAVAILABLE',
      message: 'Este recurso so esta disponivel no aplicativo instalado.',
    });
  });
});
