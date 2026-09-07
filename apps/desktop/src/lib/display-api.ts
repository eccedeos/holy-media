import type { DisplayState } from '@holy-media/types';
import { invokeCommand } from './ipc';

/** Chamadas da janela de projecao. */

export function fetchDisplayState(): Promise<DisplayState> {
  return invokeCommand<DisplayState>('display_state');
}

/** Abre a projecao no monitor escolhido, ou move a janela ja aberta para la. */
export function openDisplay(monitorIndex: number): Promise<DisplayState> {
  return invokeCommand<DisplayState>('display_open', { monitorIndex });
}

export function closeDisplay(): Promise<DisplayState> {
  return invokeCommand<DisplayState>('display_close');
}
