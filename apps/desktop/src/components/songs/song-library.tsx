import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useSongsStore } from '@/store/songs-store';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { SongList } from './song-list';
import { Button } from '@/components/ui/button';

/**
 * Painel da biblioteca: campo de busca + resultados.
 *
 * O campo mantem o texto imediatamente (digitar nunca pode engasgar); quem
 * espera e' a consulta, atras do debounce.
 */
export function SongLibrary() {
  const [text, setText] = useState('');
  const debouncedText = useDebouncedValue(text);

  const results = useSongsStore((state) => state.results);
  const status = useSongsStore((state) => state.status);
  const hasCompletedSearch = useSongsStore((state) => state.hasCompletedSearch);
  const error = useSongsStore((state) => state.error);
  const selectedId = useSongsStore((state) => state.selected?.id ?? null);
  const search = useSongsStore((state) => state.search);
  const select = useSongsStore((state) => state.select);
  const toggleFavorite = useSongsStore((state) => state.toggleFavorite);
  const startCreate = useSongsStore((state) => state.startCreate);
  const seedExamples = useSongsStore((state) => state.seedExamples);

  useEffect(() => {
    void search(debouncedText);
  }, [debouncedText, search]);

  return (
    <section aria-label="Biblioteca de musicas" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-content-muted">
            Biblioteca
          </h2>
          <Button variant="ghost" size="sm" onClick={startCreate}>
            <Plus className="size-4" aria-hidden />
            Nova musica
          </Button>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-content-muted"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Buscar por titulo, artista, letra ou tag"
            aria-label="Buscar musicas"
            className="w-full rounded-md border border-line bg-surface-sunken py-2 pl-9 pr-3 text-sm outline-none placeholder:text-content-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error !== null ? (
          <p role="alert" className="px-3 py-6 text-center text-sm text-live">
            {error.message}
          </p>
        ) : status === 'loading' && !hasCompletedSearch ? (
          <p className="px-3 py-6 text-center text-sm text-content-muted">Buscando...</p>
        ) : (
          <SongList
            songs={results}
            selectedId={selectedId}
            onSelect={(id) => void select(id)}
            onToggleFavorite={(id) => void toggleFavorite(id)}
            isSearching={debouncedText.trim() !== ''}
            onSeedExamples={() => void seedExamples()}
          />
        )}
      </div>
    </section>
  );
}
