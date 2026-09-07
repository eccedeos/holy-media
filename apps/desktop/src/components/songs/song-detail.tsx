import { useSongsStore } from '@/store/songs-store';

/**
 * Detalhe da musica selecionada: metadados e slides na ordem de projecao.
 *
 * E' leitura por enquanto. A edicao dos slides e' o proximo passo da Fase 1,
 * junto com o formulario de cadastro.
 */
export function SongDetail() {
  const song = useSongsStore((state) => state.selected);

  if (song === null) {
    return (
      <section
        aria-label="Detalhe da musica"
        className="flex h-full items-center justify-center p-8"
      >
        <p className="text-sm text-[--color-content-muted]">Selecione uma musica na biblioteca.</p>
      </section>
    );
  }

  return (
    <section aria-label="Detalhe da musica" className="flex h-full min-h-0 flex-col">
      <header className="border-b border-[--color-border-subtle] p-4">
        <h2 className="text-lg font-semibold">{song.title}</h2>
        <p className="mt-0.5 text-sm text-[--color-content-muted]">
          {song.artist === '' ? 'Sem artista' : song.artist}
        </p>
        {song.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {song.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-[--color-border-subtle] px-2 py-0.5 text-xs text-[--color-content-muted]"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {song.slides.length === 0 ? (
          <p className="text-sm text-[--color-content-muted]">Esta musica ainda nao tem slides.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {song.slides.map((slide) => (
              <li
                key={slide.id}
                className="rounded-md border border-[--color-border-subtle] bg-[--color-surface-raised] p-3"
              >
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[--color-content-muted]">
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
