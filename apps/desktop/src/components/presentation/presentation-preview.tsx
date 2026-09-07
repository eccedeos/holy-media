import { usePresentationStore } from '@/store/presentation-store';

/**
 * Previa do que a segunda tela esta mostrando.
 *
 * Renderiza exatamente o `output` do motor -- nao consulta banco, nao conhece
 * musica, nao decide nada. Quando a janela de projecao existir, ela sera' este
 * mesmo componente em tela cheia, o que garante que a previa nao minta.
 */
export function PresentationPreview() {
  const output = usePresentationStore((store) => store.state.output);

  return (
    <div
      aria-label="Previa da projecao"
      // Proporcao de tela de projetor, para a previa nao enganar sobre quanto
      // texto cabe.
      className="aspect-video w-full overflow-hidden rounded-md border border-line bg-black"
    >
      {output.kind === 'slide' ? (
        <div className="flex h-full items-center justify-center p-4">
          <p className="whitespace-pre-wrap text-center text-sm leading-snug text-white">
            {output.content}
          </p>
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
