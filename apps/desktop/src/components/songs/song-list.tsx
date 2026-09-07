import { Star } from 'lucide-react';
import type { SongSummary } from '@holy-media/types';
import { cn } from '@/lib/utils';

interface SongListProps {
  songs: readonly SongSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

/**
 * Lista de resultados da biblioteca.
 *
 * Cada linha e' um alvo grande de clique: o operador trabalha no escuro e com
 * pressa. A estrela fica fora do botao principal para que favoritar nao abra a
 * musica por engano.
 */
export function SongList({ songs, selectedId, onSelect, onToggleFavorite }: SongListProps) {
  if (songs.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-[--color-content-muted]">
        Nenhuma musica encontrada.
      </p>
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
                'hover:bg-[--color-surface-raised]',
                isSelected && 'bg-[--color-surface-raised]',
              )}
            >
              <span className="w-full truncate text-sm font-medium">{song.title}</span>
              <span className="w-full truncate text-xs text-[--color-content-muted]">
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
              className="px-3 text-[--color-content-muted] hover:text-[--color-accent]"
            >
              <Star className="size-4" aria-hidden fill={song.favorite ? 'currentColor' : 'none'} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
