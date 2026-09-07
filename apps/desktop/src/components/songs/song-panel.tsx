import { useSongsStore } from '@/store/songs-store';
import { SongDetail } from './song-detail';
import { SongForm } from './song-form';

/**
 * Painel da direita: alterna entre ver e editar a musica.
 *
 * O formulario e' remontado a cada troca de musica ou de modo (via `key`), para
 * que os campos nao carreguem o texto da musica anterior -- o tipo de bug que
 * so aparece quando alguem edita duas musicas seguidas, e que salvaria a letra
 * errada no registro errado.
 */
export function SongPanel() {
  const mode = useSongsStore((state) => state.mode);
  const song = useSongsStore((state) => state.selected);
  const error = useSongsStore((state) => state.error);
  const saving = useSongsStore((state) => state.saving);
  const create = useSongsStore((state) => state.create);
  const update = useSongsStore((state) => state.update);
  const cancelEdit = useSongsStore((state) => state.cancelEdit);

  if (mode === 'create') {
    return (
      <SongForm
        key="create"
        song={null}
        onSubmit={(input) => void create(input)}
        onCancel={cancelEdit}
        error={error?.message}
        saving={saving}
      />
    );
  }

  if (mode === 'edit' && song !== null) {
    return (
      <SongForm
        key={`edit-${song.id}`}
        song={song}
        onSubmit={(input) => void update(song.id, input)}
        onCancel={cancelEdit}
        error={error?.message}
        saving={saving}
      />
    );
  }

  return <SongDetail />;
}
