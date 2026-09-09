import type { PresentationSlideInput, PresentationState } from '@holy-media/types';
import { PRESENTATION_STATE_EVENT } from '@holy-media/types';
import { invokeCommand, isTauriAvailable } from './ipc';

/**
 * Chamadas do motor de apresentacao.
 *
 * Todo comando devolve o estado resultante, e o nucleo tambem o emite como
 * evento. Parece redundancia, mas nao e': o retorno serve a quem chamou, e o
 * evento serve as outras janelas -- a de projecao, e o celular na Fase 3.
 */

export function fetchPresentationState(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_state');
}

export function presentSong(songId: string): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_present_song', { songId });
}

/** Coloca uma referencia biblica no ar ("João 3:16", "Salmos 23"). */
export function presentBibleReference(
  translationId: string,
  reference: string,
): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_present_bible', {
    translationId,
    reference,
  });
}

/** Coloca um texto avulso no ar. `slides` ja vem dividido em blocos. */
export function presentText(slides: readonly PresentationSlideInput[]): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_present_text', { slides });
}

/** Coloca um QR Code no ar -- tipicamente uma chave PIX. */
export function presentQr(title: string, payload: string): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_present_qr', { title, payload });
}

export function presentationNext(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_next');
}

export function presentationPrevious(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_previous');
}

export function presentationFirst(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_first');
}

export function presentationLast(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_last');
}

export function presentationGoTo(index: number): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_go_to', { index });
}

export function presentationToggleBlackout(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_toggle_blackout');
}

export function presentationClear(): Promise<PresentationState> {
  return invokeCommand<PresentationState>('presentation_clear');
}

/**
 * Escuta as mudancas do motor. Devolve a funcao que cancela a assinatura.
 *
 * Fora do Tauri nao ha o que escutar, e a funcao vira um no-op em vez de
 * quebrar -- a interface continua abrindo no navegador.
 */
export async function onPresentationState(
  handler: (state: PresentationState) => void,
): Promise<() => void> {
  if (!isTauriAvailable()) return () => {};

  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<PresentationState>(PRESENTATION_STATE_EVENT, (event) =>
    handler(event.payload),
  );
  return unlisten;
}
