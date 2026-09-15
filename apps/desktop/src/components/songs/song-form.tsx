import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { LyricsSearchResult, Song, SongInput } from '@holy-media/types';
import { Button } from '@/components/ui/button';
import { formatLyrics, parseLyrics, parseTags } from '@/lib/lyrics';
import { searchLyricsOnline } from '@/lib/lyrics-api';
import { createAppError, describeUnknown, isAppError } from '@/lib/ipc';
import { cn } from '@/lib/utils';

interface SongFormProps {
  /** Musica sendo editada, ou `null` para cadastro novo. */
  song: Song | null;
  onSubmit: (input: SongInput) => void;
  onCancel: () => void;
  /** Mensagem de erro vinda do nucleo, ja em portugues. */
  error?: string | undefined;
  saving?: boolean;
}

const fieldClass =
  'w-full rounded-md border border-line bg-surface-sunken ' +
  'px-3 py-2 text-sm outline-none placeholder:text-content-muted ' +
  'focus-visible:ring-2 focus-visible:ring-accent';

const labelClass = 'mb-1 block text-xs font-medium text-content-muted';

/**
 * Cadastro e edicao de musica.
 *
 * A letra e' um campo de texto so'. A divisao em slides sai da propria escrita
 * -- linha em branco separa estrofe -- e o contador ao lado mostra, enquanto se
 * digita, quantos slides vao para a tela. Isso deixa colar uma letra inteira e
 * salvar, que e' como a musica realmente chega ao operador.
 */
export function SongForm({ song, onSubmit, onCancel, error, saving = false }: SongFormProps) {
  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [author, setAuthor] = useState(song?.author ?? '');
  const [category, setCategory] = useState(song?.category ?? '');
  const [tagsText, setTagsText] = useState(song?.tags.join(', ') ?? '');
  const [lyrics, setLyrics] = useState(song === null ? '' : formatLyrics(song.slides));

  const [lyricsQuery, setLyricsQuery] = useState('');
  const [lyricsResults, setLyricsResults] = useState<readonly LyricsSearchResult[] | null>(null);
  const [lyricsSearching, setLyricsSearching] = useState(false);
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  const slides = useMemo(() => parseLyrics(lyrics), [lyrics]);

  const handleSearchLyrics = async () => {
    const query = lyricsQuery.trim();
    if (query === '') return;

    setLyricsSearching(true);
    setLyricsError(null);
    try {
      const results = await searchLyricsOnline(query);
      setLyricsResults(results);
    } catch (cause) {
      const error = isAppError(cause) ? cause : createAppError('UNKNOWN', describeUnknown(cause));
      setLyricsError(error.message);
      setLyricsResults(null);
    } finally {
      setLyricsSearching(false);
    }
  };

  const handleUseLyricsResult = (result: LyricsSearchResult) => {
    setLyrics(result.lyrics);
    if (artist.trim() === '') setArtist(result.artistName);
    if (title.trim() === '') setTitle(result.trackName);
    setLyricsResults(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      title,
      artist,
      author,
      category,
      favorite: song?.favorite ?? false,
      tags: parseTags(tagsText),
      slides,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={song === null ? 'Nova musica' : `Editar ${song.title}`}
      className="flex h-full min-h-0 flex-col"
    >
      <header className="shrink-0 border-b border-line p-4">
        <h2 className="text-lg font-semibold">{song === null ? 'Nova musica' : 'Editar musica'}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="song-title">
              Titulo
            </label>
            <input
              id="song-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="song-artist">
              Artista
            </label>
            <input
              id="song-artist"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="song-author">
              Autor
            </label>
            <input
              id="song-author"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="song-category">
              Categoria
            </label>
            <input
              id="song-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="song-tags">
              Tags (separadas por virgula)
            </label>
            <input
              id="song-tags"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="natal, ceia"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass} htmlFor="song-lyrics-search">
            Buscar letra online
          </label>
          <div className="flex gap-2">
            <input
              id="song-lyrics-search"
              value={lyricsQuery}
              onChange={(event) => setLyricsQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearchLyrics();
                }
              }}
              placeholder="Titulo e/ou artista"
              className={fieldClass}
            />
            <Button
              type="button"
              variant="outline"
              disabled={lyricsQuery.trim() === '' || lyricsSearching}
              onClick={() => void handleSearchLyrics()}
            >
              <Search className="size-4" aria-hidden />
              {lyricsSearching ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>
          <p className="mt-1 text-xs text-content-muted">
            Resultado de terceiros (lrclib.net) -- confira e edite antes de salvar. A
            responsabilidade pelo uso da letra e' de quem a importa.
          </p>

          {lyricsError !== null && (
            <p role="alert" className="mt-1 text-xs text-live">
              {lyricsError}
            </p>
          )}

          {lyricsResults !== null && (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border border-line p-1">
              {lyricsResults.length === 0 ? (
                <li className="px-2 py-1 text-xs text-content-muted">Nenhum resultado.</li>
              ) : (
                lyricsResults.map((result, index) => (
                  <li key={`${result.trackName}-${result.artistName}-${index}`}>
                    <button
                      type="button"
                      onClick={() => handleUseLyricsResult(result)}
                      className="w-full rounded-md px-2 py-1 text-left text-xs hover:bg-surface-sunken"
                    >
                      <span className="font-medium">{result.trackName}</span>
                      {' — '}
                      <span className="text-content-muted">{result.artistName}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-baseline justify-between">
            <label className={cn(labelClass, 'mb-0')} htmlFor="song-lyrics">
              Letra
            </label>
            <span className="text-xs text-content-muted">
              {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
            </span>
          </div>
          <textarea
            id="song-lyrics"
            value={lyrics}
            onChange={(event) => setLyrics(event.target.value)}
            rows={16}
            spellCheck={false}
            placeholder={'[Verso 1]\nPrimeira estrofe\n\n[Refrao]\nSegunda estrofe'}
            className={cn(fieldClass, 'resize-none font-mono leading-relaxed')}
          />
          <p className="mt-1 text-xs text-content-muted">
            Linha em branco separa os slides. Uma primeira linha como <code>[Refrao]</code> vira a
            marcacao do bloco.
          </p>
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-line p-4">
        <Button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        {error !== undefined && (
          <p role="alert" className="text-sm text-live">
            {error}
          </p>
        )}
      </footer>
    </form>
  );
}
