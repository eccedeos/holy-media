import type { BackgroundInput, BackgroundSettings } from '@holy-media/types';
import { BACKGROUND_CHANGED_EVENT } from '@holy-media/types';
import { invokeCommand, isTauriAvailable } from './ipc';

/**
 * Chamadas do fundo da projecao.
 *
 * Mesmo padrao do motor de apresentacao: o comando devolve o fundo
 * resultante, e o nucleo tambem o emite como evento para a janela de
 * projecao acompanhar sem precisar buscar de novo.
 */

export function fetchBackgroundSettings(): Promise<BackgroundSettings> {
  return invokeCommand<BackgroundSettings>('background_get');
}

export function setBackground(input: BackgroundInput): Promise<BackgroundSettings> {
  return invokeCommand<BackgroundSettings>('background_set', { input });
}

/** Escuta as mudancas do fundo. Devolve a funcao que cancela a assinatura. */
export async function onBackgroundChanged(
  handler: (settings: BackgroundSettings) => void,
): Promise<() => void> {
  if (!isTauriAvailable()) return () => {};

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<BackgroundSettings>(BACKGROUND_CHANGED_EVENT, (event) =>
    handler(event.payload),
  );
  return unlisten;
}
