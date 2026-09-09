import { useEffect } from 'react';
import { usePresentationStore } from '@/store/presentation-store';
import { useBackgroundStore } from '@/store/background-store';
import { backgroundStyle } from '@/lib/background-style';
import { QrCode } from './qr-code';

/**
 * A tela que a congregacao ve.
 *
 * Regras que valem aqui e em nenhum outro lugar do aplicativo:
 *
 * - **So conteudo.** Sem menus, sem botoes, sem indicador de posicao, sem
 *   cursor. Qualquer pixel de interface aqui e' um erro visivel para a igreja
 *   inteira.
 * - **O render mais barato possivel.** Nenhuma animacao sem proposito, nenhum
 *   componente que nao precise existir. Esta janela roda ao lado do Control
 *   Room no mesmo PC fraco.
 * - **Nao decide nada.** Renderiza o `Output` que o motor manda, e ponto. Nao
 *   consulta banco, nao conhece musica, nao calcula limite de navegacao.
 */
export function ProjectionScreen() {
  const output = usePresentationStore((store) => store.state.output);
  const connect = usePresentationStore((store) => store.connect);
  const background = useBackgroundStore((store) => store.settings);
  const connectBackground = useBackgroundStore((store) => store.connect);

  useEffect(() => {
    const pendente = connect();
    return () => {
      void pendente.then((unlisten) => unlisten());
    };
  }, [connect]);

  useEffect(() => {
    const pendente = connectBackground();
    return () => {
      void pendente.then((unlisten) => unlisten());
    };
  }, [connectBackground]);

  // O fundo configurado so' aparece com conteudo no ar: `idle` (espera) e
  // `black` (blackout pedido pelo operador) continuam pretos de proposito --
  // ver o comentario abaixo sobre por que blackout nao pode deixar o fundo
  // escolhido "vazar".
  const style = output.kind === 'slide' || output.kind === 'qr' ? backgroundStyle(background) : {};

  return (
    <main className="flex h-full w-full items-center justify-center bg-black" style={style}>
      {output.kind === 'slide' && (
        <p
          className="whitespace-pre-wrap px-[6vw] text-center font-semibold leading-tight text-white"
          // Tamanho em vw: a mesma letra precisa encher tanto um projetor de
          // 1024x768 quanto uma TV 4K, sem ninguem reconfigurar nada.
          style={{ fontSize: 'clamp(1.5rem, 5.5vw, 12rem)' }}
        >
          {output.content}
        </p>
      )}
      {output.kind === 'qr' && <QrCode payload={output.content} className="h-[70vh]" />}
      {/* `idle` e `black` renderizam o fundo preto e nada mais. Sao estados
          diferentes no motor -- a tela de espera da Fase 2 entra no `idle` --
          mas hoje se parecem, e forcar uma diferenca visual agora seria
          inventar uma funcionalidade que ninguem pediu. Blackout continua
          preto solido mesmo com um fundo de imagem configurado: "tela preta"
          e' o controle de emergencia do operador, e ele perderia a funcao se
          deixasse qualquer coisa visivel atras. */}
    </main>
  );
}
