import { useState } from 'react';
import { ListPlus, Pencil, Play, Trash2 } from 'lucide-react';
import { useSongsStore } from '@/store/songs-store';
import { usePresentationStore } from '@/store/presentation-store';
import { useServicesStore } from '@/store/services-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Detalhe da musica selecionada: metadados e slides na ordem de projecao.
 *
 * E' leitura por enquanto. A edicao dos slides e' o proximo passo da Fase 1,
 * junto com o formulario de cadastro.
 */
export function SongDetail() {
  const song = useSongsStore((state) => state.selected);
  const startEdit = useSongsStore((state) => state.startEdit);
  const remove = useSongsStore((state) => state.remove);
  const present = usePresentationStore((store) => store.present);
  const goTo = usePresentationStore((store) => store.goTo);
  const live = usePresentationStore((store) => store.state);
  const addSongToService = useServicesStore((store) => store.addSong);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (song === null) {
    return (
      <section
        aria-label="Detalhe da musica"
        className="flex h-full items-center justify-center p-8"
      >
        <p className="text-sm text-content-muted">Selecione uma musica na biblioteca.</p>
      </section>
    );
  }

  return (
    <section aria-label="Detalhe da musica" className="flex h-full min-h-0 flex-col">
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{song.title}</h2>
            <p className="mt-0.5 text-sm text-content-muted">
              {song.artist === '' ? 'Sem artista' : song.artist}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" onClick={() => void present(song.id)}>
              <Play className="size-4" aria-hidden />
              Apresentar
            </Button>
            <Button variant="outline" size="sm" onClick={() => void addSongToService(song.id)}>
              <ListPlus className="size-4" aria-hidden />
              Adicionar
            </Button>
            <Button variant="ghost" size="sm" onClick={startEdit}>
              <Pencil className="size-4" aria-hidden />
              Editar
            </Button>
            {/* Exclusao pede confirmacao no proprio lugar: um clique sozinho
                nao pode apagar uma musica que levou tempo para ser cadastrada. */}
            {confirmingDelete ? (
              <>
                <Button
                  variant="live"
                  size="sm"
                  onClick={() => {
                    setConfirmingDelete(false);
                    void remove(song.id);
                  }}
                >
                  Confirmar exclusao
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
                aria-label={`Excluir ${song.title}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
        {song.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {song.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-line px-2 py-0.5 text-xs text-content-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {song.slides.length === 0 ? (
          <p className="text-sm text-content-muted">Esta musica ainda nao tem slides.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {song.slides.map((slide) => {
              // Um slide so' esta "no ar" se for desta musica: o motor guarda a
              // origem justamente para o Control Room nao destacar a linha
              // errada enquanto outra musica projeta.
              const projetando = live.sourceId === song.id;
              const noAr = projetando && live.index === slide.position;

              return (
                <li key={slide.id}>
                  <button
                    type="button"
                    // Clicar num slide so' projeta se a musica ja estiver no ar.
                    // Pular direto para o meio de outra musica trocaria o que a
                    // congregacao ve sem o operador pedir.
                    onClick={() => {
                      if (projetando) void goTo(slide.position);
                    }}
                    aria-current={noAr ? 'true' : undefined}
                    className={cn(
                      'w-full rounded-md border bg-surface-raised p-3 text-left transition-colors',
                      noAr ? 'border-accent' : 'border-line',
                      projetando ? 'hover:border-content-muted' : 'cursor-default',
                    )}
                  >
                    <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                      {slide.label === '' ? `Slide ${slide.position + 1}` : slide.label}
                      {noAr && <span className="text-accent">· no ar</span>}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{slide.content}</p>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
