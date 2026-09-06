import type { AppError, AppErrorCode, AppInfo } from '@holy-media/types';
import { createLogger } from './logger';

/**
 * Ponte entre a interface e o nucleo Rust (secao 22 do briefing).
 *
 * Toda chamada passa por aqui para que:
 * - nenhum erro do Tauri escape cru para a arvore React;
 * - o operador receba portugues, e o log fique com o detalhe tecnico;
 * - a interface continue funcionando no navegador (`vite dev`), onde o Tauri
 *   nao existe, em vez de quebrar na primeira chamada.
 */

const log = createLogger('ipc');

const FRIENDLY_MESSAGES: Record<AppErrorCode, string> = {
  IPC_FAILED: 'Nao foi possivel se comunicar com o nucleo do aplicativo.',
  IPC_UNAVAILABLE: 'Este recurso so esta disponivel no aplicativo instalado.',
  UNKNOWN: 'Ocorreu um erro inesperado.',
};

export function createAppError(code: AppErrorCode, detail?: string, message?: string): AppError {
  const base = { code, message: message ?? FRIENDLY_MESSAGES[code] };
  return detail === undefined ? base : { ...base, detail };
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as AppError).message === 'string'
  );
}

/** Extrai texto legivel de qualquer coisa que o Tauri possa rejeitar. */
export function describeUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** `true` quando a interface esta hospedada dentro de uma janela Tauri. */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Executa um comando Tauri devolvendo erro normalizado em vez de excecao crua.
 *
 * O `invoke` e' importado sob demanda para que o bundle do navegador nao
 * carregue a API do Tauri quando ela nao pode ser usada.
 */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauriAvailable()) {
    const error = createAppError('IPC_UNAVAILABLE', `comando "${command}" fora do Tauri`);
    log.warn('comando ignorado: runtime Tauri ausente', { command });
    throw error;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (cause) {
    const detail = describeUnknown(cause);
    log.error('comando falhou', { command, detail });
    throw createAppError('IPC_FAILED', detail);
  }
}

/** Identificacao do aplicativo, vinda do nucleo Rust. */
export function fetchAppInfo(): Promise<AppInfo> {
  return invokeCommand<AppInfo>('app_info');
}
