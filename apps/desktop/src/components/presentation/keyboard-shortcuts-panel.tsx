import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ACTION_LABELS, ACTION_ORDER } from '@/lib/keyboard-shortcuts';
import { useKeyboardShortcutsStore } from '@/store/keyboard-shortcuts-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Nome legivel de uma tecla. A maioria das teclas nomeadas (`ArrowRight`,
 * `Home`) ja vem legivel do proprio `KeyboardEvent.key`; so as setas ganham
 * uma seta de verdade, que e' mais rapido de ler numa lista curta. */
const KEY_LABELS: Record<string, string> = {
  ArrowRight: '→',
  ArrowLeft: '←',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ' ': 'Espaco',
};

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/**
 * Painel de atalhos de teclado: mostra a tecla de cada acao e deixa
 * reconfigurar.
 *
 * Comeca fechado -- a coluna do operador ja tem projecao, fundo e ordem do
 * culto; atalhos sao um recurso de descoberta ocasional, nao algo que
 * precise ocupar espaco toda vez que o Control Room abre.
 */
export function KeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false);
  const bindings = useKeyboardShortcutsStore((store) => store.bindings);
  const capturing = useKeyboardShortcutsStore((store) => store.capturing);
  const error = useKeyboardShortcutsStore((store) => store.error);
  const startCapture = useKeyboardShortcutsStore((store) => store.startCapture);
  const resetToDefaults = useKeyboardShortcutsStore((store) => store.resetToDefaults);

  return (
    <section aria-label="Atalhos de teclado" className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wide text-content-muted hover:bg-surface-raised"
      >
        Atalhos
        {open ? (
          <ChevronUp className="size-3.5" aria-hidden />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <ul className="flex flex-col gap-1">
            {ACTION_ORDER.map((action) => (
              <li key={action} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-content-muted">{ACTION_LABELS[action]}</span>
                {capturing === action ? (
                  <span className="rounded border border-accent px-2 py-0.5 text-accent">
                    Pressione uma tecla... (Esc cancela)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCapture(action)}
                    disabled={capturing !== null}
                    className={cn(
                      'rounded border border-line px-2 py-0.5 font-mono',
                      capturing === null && 'hover:bg-surface-raised',
                    )}
                  >
                    {keyLabel(bindings[action])}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {error !== null && (
            <p role="alert" className="text-xs text-live">
              {error}
            </p>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => resetToDefaults()}
            className="self-start"
          >
            Restaurar padrao
          </Button>

          <p className="text-xs text-content-muted">
            Atalhos nao funcionam enquanto um campo de texto esta em foco.
          </p>
        </div>
      )}
    </section>
  );
}
