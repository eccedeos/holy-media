import { Star } from 'lucide-react';
import type { SongSummary } from '@holy-media/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SongListProps {
  songs: readonly SongSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  /** `true` quando a lista esta vazia por causa da busca, nao da biblioteca. */
  isSearching: boolean;
  onSeedExamples: () => void;
}

/**
 * Lista de resultados da biblioteca.
 *
 * Cada linha e' um alvo grande de clique: o operador trabalha no escuro e com
 * pressa. A estrela fica fora do botao principal para que favoritar nao abra a
 * musica por engano.
 */
export function SongList({
  songs,
  selectedId,
  onSelect,
  onToggleFavorite,
  isSearching,
  onSeedExamples,
}: SongListProps) {
  if (songs.length === 0) {
    // Distinguir os dois casos importa: "nao achei o que voce procurou" e
    // "sua biblioteca esta vazia" pedem acoes diferentes do operador.
    if (isSearching) {
      return (
        <p className="px-3 py-6 text-center text-sm text-content-muted">
          Nenhuma musica encontrada para essa busca.
        </p>
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
        <p className="text-sm text-content-muted">Sua biblioteca esta vazia.</p>
        <Button variant="outline" size="sm" onClick={onSeedExamples}>
          Adicionar musicas de exemplo
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {songs.map((song) => {
        const isSelected = song.id === selectedId;

        return (
          <li key={song.id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => onSelect(song.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left',
                'hover:bg-surface-raised',
                isSelected && 'bg-surface-raised',
              )}
            >
              <span className="w-full truncate text-sm font-medium">{song.title}</span>
              <span className="w-full truncate text-xs text-content-muted">
                {song.artist === '' ? 'Sem artista' : song.artist}
                {' · '}
                {song.slideCount} {song.slideCount === 1 ? 'slide' : 'slides'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(song.id)}
              aria-label={song.favorite ? `Desfavoritar ${song.title}` : `Favoritar ${song.title}`}
              aria-pressed={song.favorite}
              className="px-3 text-content-muted hover:text-accent"
            >
              <Star className="size-4" aria-hidden fill={song.favorite ? 'currentColor' : 'none'} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
