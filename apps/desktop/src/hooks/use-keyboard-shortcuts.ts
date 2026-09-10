import { useEffect } from 'react';
import { isTypingTarget, matchAction, type ShortcutAction } from '@/lib/keyboard-shortcuts';
import { useKeyboardShortcutsStore } from '@/store/keyboard-shortcuts-store';
import { usePresentationStore } from '@/store/presentation-store';

/**
 * Liga os atalhos de teclado aos comandos de apresentação.
 *
 * Chamado **uma vez**, em `App` -- é o único `addEventListener('keydown', ...)`
 * do aplicativo. Funciona em qualquer aba de conteúdo (Músicas, Bíblia,
 * Texto, QR Code): o operador pode estar navegando a Bíblia e ainda assim
 * apertar a seta para avançar o slide que já está no ar, porque a coluna do
 * operador é sempre a mesma, independente da aba.
 *
 * Também escuta o teclado durante a captura de uma nova tecla (o painel de
 * atalhos pedindo "pressione uma tecla") -- um segundo listener aqui
 * duplicaria a lógica de ignorar campo de texto/Ctrl+Alt+Meta que
 * `matchAction` já resolve.
 */
export function useKeyboardShortcuts(): void {
  const bindings = useKeyboardShortcutsStore((store) => store.bindings);
  const capturing = useKeyboardShortcutsStore((store) => store.capturing);
  const bind = useKeyboardShortcutsStore((store) => store.bind);
  const cancelCapture = useKeyboardShortcutsStore((store) => store.cancelCapture);

  const next = usePresentationStore((store) => store.next);
  const previous = usePresentationStore((store) => store.previous);
  const first = usePresentationStore((store) => store.first);
  const last = usePresentationStore((store) => store.last);
  const toggleBlackout = usePresentationStore((store) => store.toggleBlackout);
  const clear = usePresentationStore((store) => store.clear);

  useEffect(() => {
    const actions: Record<ShortcutAction, () => void> = {
      next: () => void next(),
      previous: () => void previous(),
      first: () => void first(),
      last: () => void last(),
      toggleBlackout: () => void toggleBlackout(),
      clear: () => void clear(),
    };

    function handleKeyDown(event: KeyboardEvent) {
      if (capturing !== null) {
        // Escape sempre cancela a captura, nunca vira a tecla de um atalho --
        // e' o gesto universal de "sair disto" em qualquer sistema, e vira-lo
        // ligavel surpreenderia mais do que ajudaria.
        if (event.key === 'Escape') {
          cancelCapture();
          return;
        }
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        bind(capturing, event.key);
        return;
      }

      const action = matchAction(event, bindings);
      if (action === null) return;

      event.preventDefault();
      actions[action]();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    bindings,
    capturing,
    bind,
    cancelCapture,
    next,
    previous,
    first,
    last,
    toggleBlackout,
    clear,
  ]);
}
