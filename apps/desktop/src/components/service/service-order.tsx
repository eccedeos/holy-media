import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ListMusic, Plus, Trash2 } from 'lucide-react';
import { useServicesStore } from '@/store/services-store';
import { usePresentationStore } from '@/store/presentation-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A ordem do culto: a sequencia de itens que o operador monta antes e
 * percorre durante o culto (secao 12 do briefing).
 *
 * Clicar num item o coloca no ar -- reusa o mesmo comando de apresentar que a
 * biblioteca usa, porque a ordem do culto nao e' um motor paralelo: ela so'
 * decide *o que* apresentar em seguida, e quem apresenta continua sendo o
 * Presentation Engine.
 */
export function ServiceOrder() {
  const services = useServicesStore((store) => store.services);
  const active = useServicesStore((store) => store.active);
  const error = useServicesStore((store) => store.error);
  const refresh = useServicesStore((store) => store.refresh);
  const select = useServicesStore((store) => store.select);
  const create = useServicesStore((store) => store.create);
  const removeItem = useServicesStore((store) => store.removeItem);
  const duplicateItem = useServicesStore((store) => store.duplicateItem);
  const moveItem = useServicesStore((store) => store.moveItem);

  const sourceId = usePresentationStore((store) => store.state.sourceId);
  const present = usePresentationStore((store) => store.present);

  const [novoTitulo, setNovoTitulo] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCriar = (event: React.FormEvent) => {
    event.preventDefault();
    const title = novoTitulo.trim();
    if (title === '') return;
    void create(title);
    setNovoTitulo('');
  };

  return (
    <section
      aria-label="Ordem do culto"
      className="flex min-h-0 flex-1 flex-col border-t border-line"
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">
          Ordem do culto
        </h2>
      </div>

      {active === null ? (
        <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
          {services.length > 0 && (
            <ul className="flex flex-col gap-1">
              {services.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => void select(service.id)}
                    className="w-full rounded-md border border-line px-2 py-1.5 text-left text-xs hover:bg-surface-raised"
                  >
                    <span className="flex items-center gap-1.5">
                      <ListMusic className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate font-medium">{service.title}</span>
                    </span>
                    <span className="mt-0.5 block text-content-muted">
                      {service.itemCount} {service.itemCount === 1 ? 'item' : 'itens'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleCriar} className="flex gap-1.5">
            <input
              value={novoTitulo}
              onChange={(event) => setNovoTitulo(event.target.value)}
              placeholder="Culto de domingo"
              aria-label="Titulo da nova ordem do culto"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-sunken px-2 py-1.5 text-xs outline-none placeholder:text-content-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
            <Button type="submit" size="sm">
              <Plus className="size-3.5" aria-hidden />
              Criar
            </Button>
          </form>

          <p className="text-xs text-content-muted">
            Ou clique em &quot;Adicionar&quot; numa musica na biblioteca para comecar uma.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="truncate text-sm font-medium">{active.title}</p>
          </div>

          <ol className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {active.items.length === 0 ? (
              <p className="py-3 text-xs text-content-muted">
                Nenhum item ainda. Adicione uma musica pela biblioteca.
              </p>
            ) : (
              active.items.map((item, index) => {
                const noAr = item.kind === 'song' && sourceId === item.referenceId;

                return (
                  <li key={item.id} className="mb-1.5 flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.kind === 'song' && item.referenceId !== null) {
                          void present(item.referenceId);
                        }
                      }}
                      aria-current={noAr ? 'true' : undefined}
                      className={cn(
                        'min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-left text-xs',
                        noAr
                          ? 'border-accent bg-surface-raised text-accent'
                          : 'border-line hover:bg-surface-raised',
                      )}
                    >
                      <span className="text-content-muted">{index + 1}.</span> {item.title}
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void moveItem(item.id, index - 1)}
                        disabled={index === 0}
                        aria-label={`Mover ${item.title} para cima`}
                      >
                        <ChevronUp className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void moveItem(item.id, index + 1)}
                        disabled={index === active.items.length - 1}
                        aria-label={`Mover ${item.title} para baixo`}
                      >
                        <ChevronDown className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void duplicateItem(item.id)}
                        aria-label={`Duplicar ${item.title}`}
                      >
                        <Copy className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeItem(item.id)}
                        aria-label={`Remover ${item.title}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </li>
                );
              })
            )}
          </ol>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="px-3 pb-2 text-xs text-live">
          {error.message}
        </p>
      )}
    </section>
  );
}
