import { useEffect } from 'react';
import { Monitor, MonitorOff } from 'lucide-react';
import { useDisplayStore } from '@/store/display-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Escolha do monitor de projecao.
 *
 * Fica no topo da coluna de controle porque e' a primeira coisa que o operador
 * faz ao chegar, e a que ele precisa conferir se o projetor piscar no meio do
 * culto.
 */
export function DisplayPicker() {
  const state = useDisplayStore((store) => store.state);
  const error = useDisplayStore((store) => store.error);
  const refresh = useDisplayStore((store) => store.refresh);
  const open = useDisplayStore((store) => store.open);
  const close = useDisplayStore((store) => store.close);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section aria-label="Tela de projecao" className="flex flex-col gap-2 border-b border-line p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">Projecao</h2>
        {state.isOpen && (
          <Button variant="ghost" size="sm" onClick={() => void close()}>
            <MonitorOff className="size-4" aria-hidden />
            Fechar
          </Button>
        )}
      </div>

      {state.monitors.length === 0 ? (
        <p className="text-xs text-content-muted">Nenhum monitor detectado.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {state.monitors.map((monitor) => {
            const emUso = state.isOpen && state.monitorIndex === monitor.index;

            return (
              <li key={monitor.index}>
                <button
                  type="button"
                  onClick={() => void open(monitor.index)}
                  aria-pressed={emUso}
                  className={cn(
                    'w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                    emUso
                      ? 'border-accent bg-surface-raised'
                      : 'border-line hover:bg-surface-raised',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Monitor className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate font-medium">{monitor.name}</span>
                    {emUso && <span className="ml-auto shrink-0 text-accent">no ar</span>}
                  </span>
                  <span className="mt-0.5 block text-content-muted">
                    {monitor.width} × {monitor.height}
                    {/* Projetar no monitor do operador cobre a propria tela de
                        quem esta operando -- vale o aviso antes do clique. */}
                    {monitor.isCurrent && ' · tela do operador'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error !== null && (
        <p role="alert" className="text-xs text-live">
          {error.message}
        </p>
      )}
    </section>
  );
}
