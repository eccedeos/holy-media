import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePresentationStore } from '@/store/presentation-store';
import { parseLyrics } from '@/lib/lyrics';

const fieldClass =
  'w-full rounded-md border border-line bg-surface-sunken ' +
  'px-3 py-2 text-sm outline-none placeholder:text-content-muted ' +
  'focus-visible:ring-2 focus-visible:ring-accent';

/**
 * Texto avulso: um aviso, uma oracao, um lembrete -- digitado na hora, sem
 * passar pela biblioteca de musicas e sem ficar salvo em lugar nenhum.
 *
 * Reusa a mesma convencao do editor de letras (linha em branco separa
 * slide, via `parseLyrics`): quem ja aprendeu isso para cadastrar musica nao
 * precisa aprender uma segunda regra aqui.
 */
export function FreeTextPanel() {
  const [text, setText] = useState('');
  const presentText = usePresentationStore((state) => state.presentText);
  const error = usePresentationStore((state) => state.error);

  const slides = useMemo(() => parseLyrics(text), [text]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (slides.length === 0) return;
    void presentText(slides);
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Texto avulso"
      className="flex h-full min-h-0 flex-col gap-3 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Texto avulso</h2>
        <Button type="submit" size="sm" disabled={slides.length === 0}>
          <Play className="size-4" aria-hidden />
          Apresentar
        </Button>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'Bem-vindos ao culto!\n\nA oferta comeca em 5 minutos.'}
        aria-label="Conteudo do aviso"
        spellCheck={false}
        className={`${fieldClass} min-h-0 flex-1 resize-none font-mono leading-relaxed`}
      />

      <p className="text-xs text-content-muted">
        {slides.length === 0
          ? 'Linha em branco separa slides -- igual no cadastro de musica.'
          : `${slides.length} slide(s).`}
      </p>

      {error !== null && (
        <p role="alert" className="text-xs text-live">
          {error.message}
        </p>
      )}
    </form>
  );
}
