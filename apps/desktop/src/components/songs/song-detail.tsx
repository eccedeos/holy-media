import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useSongsStore } from '@/store/songs-store';
import { Button } from '@/components/ui/button';

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
            {song.slides.map((slide) => (
              <li key={slide.id} className="rounded-md border border-line bg-surface-raised p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-muted">
                  {slide.label === '' ? `Slide ${slide.position + 1}` : slide.label}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{slide.content}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
