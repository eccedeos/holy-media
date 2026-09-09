import { usePresentationStore } from '@/store/presentation-store';
import { useBackgroundStore } from '@/store/background-store';
import { backgroundStyle } from '@/lib/background-style';
import { QrCode } from './qr-code';

/**
 * Previa do que a segunda tela esta mostrando.
 *
 * Renderiza exatamente o `output` do motor e o fundo configurado -- nao
 * consulta banco, nao conhece musica, nao decide nada. E' o mesmo par de
 * `output`/`background` que a janela de projecao usa, para a previa nunca
 * mentir sobre o que esta realmente no ar.
 */
export function PresentationPreview() {
  const output = usePresentationStore((store) => store.state.output);
  const background = useBackgroundStore((store) => store.settings);

  const style = output.kind === 'slide' || output.kind === 'qr' ? backgroundStyle(background) : {};

  return (
    <div
      aria-label="Previa da projecao"
      // Proporcao de tela de projetor, para a previa nao enganar sobre quanto
      // texto cabe.
      className="aspect-video w-full overflow-hidden rounded-md border border-line bg-black"
      style={style}
    >
      {output.kind === 'slide' ? (
        <div className="flex h-full items-center justify-center p-4">
          <p className="whitespace-pre-wrap text-center text-sm leading-snug text-white">
            {output.content}
          </p>
        </div>
      ) : output.kind === 'qr' ? (
        <div className="flex h-full items-center justify-center p-4">
          <QrCode payload={output.content} className="h-full" />
        </div>
      ) : output.kind === 'black' ? (
        <div className="flex h-full items-center justify-center">
          <span className="text-xs uppercase tracking-widest text-content-muted">tela preta</span>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-xs uppercase tracking-widest text-content-muted">nada no ar</span>
        </div>
      )}
    </div>
  );
}
