import { create } from 'zustand';
import {
  ACTION_ORDER,
  DEFAULT_BINDINGS,
  type Bindings,
  type ShortcutAction,
} from '@/lib/keyboard-shortcuts';

/**
 * Ligações atuais dos atalhos.
 *
 * Em memória só, de propósito: assim como a escolha de monitor
 * (`SelectedMonitor`, no núcleo), isto ainda não é persistido -- entra
 * quando existir uma tabela geral de configurações (Fase 4). Reinventar
 * persistência só para atalhos, antes da tabela de verdade, duplicaria o
 * problema em vez de resolvê-lo. Enquanto isso, o operador reconfigura ao
 * abrir o aplicativo, se quiser.
 */
interface KeyboardShortcutsStoreState {
  bindings: Bindings;
  /** Ação cuja tecla está sendo capturada agora, ou `null`. A interface usa
   * isto para mostrar "pressione uma tecla..." na linha certa. */
  capturing: ShortcutAction | null;
  /** Erro do momento (ex.: tecla já usada por outro atalho). */
  error: string | null;

  startCapture: (action: ShortcutAction) => void;
  cancelCapture: () => void;
  /** Tenta ligar `key` a `action`. Recusa uma tecla já usada por outro
   * atalho -- dois atalhos na mesma tecla silenciosamente escolheriam um
   * dos dois toda vez, o que é mais confuso do que recusar na hora. */
  bind: (action: ShortcutAction, key: string) => void;
  resetToDefaults: () => void;
}

export const useKeyboardShortcutsStore = create<KeyboardShortcutsStoreState>((set, get) => ({
  bindings: DEFAULT_BINDINGS,
  capturing: null,
  error: null,

  startCapture: (action) => set({ capturing: action, error: null }),
  cancelCapture: () => set({ capturing: null }),

  bind: (action, key) => {
    const { bindings } = get();
    const emUsoPor = ACTION_ORDER.find(
      (candidate) =>
        candidate !== action && bindings[candidate].toLowerCase() === key.toLowerCase(),
    );
    if (emUsoPor !== undefined) {
      set({ error: `"${key}" já está em uso.`, capturing: null });
      return;
    }

    set({ bindings: { ...bindings, [action]: key }, capturing: null, error: null });
  },

  resetToDefaults: () => set({ bindings: DEFAULT_BINDINGS, capturing: null, error: null }),
}));

/** Reseta o estado. Existe para os testes nao vazarem estado entre si. */
export function resetKeyboardShortcutsStore(): void {
  useKeyboardShortcutsStore.setState({ bindings: DEFAULT_BINDINGS, capturing: null, error: null });
}
