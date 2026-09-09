import { useMemo } from 'react';
import qrcodeGenerator from 'qrcode-generator';
import { cn } from '@/lib/utils';

/**
 * Desenha um QR Code a partir de um payload de texto puro.
 *
 * De proposito **fora** do nucleo Rust: quem decide como um payload vira
 * desenho e' a tela de projecao (e a previa, que usa o mesmo componente),
 * nunca o motor de apresentacao -- ver o comentario de `Output::Qr` em
 * `presentation/model.rs`.
 *
 * `qrcode-generator` (~10 kB gzip no bundle final, sem dependencias) foi
 * escolhido sobre gerar a imagem no Rust e mandar pelo IPC: o payload de
 * texto e' muito menor que um PNG/SVG ja desenhado, e desenhar so' custa CPU
 * na janela que esta mostrando o codigo, nao nas duas ao mesmo tempo.
 */
export function QrCode({
  payload,
  className,
}: {
  readonly payload: string;
  /** Tamanho decidido por quem usa o componente -- a tela cheia de projecao
   * (limitada pela altura, para nunca ultrapassar um telao 16:9) e a previa
   * pequena (limitada pela altura do card) precisam de contas diferentes. */
  readonly className?: string;
}) {
  const svg = useMemo(() => {
    const code = qrcodeGenerator(0, 'M');
    code.addData(payload);
    code.make();
    // `scalable: true` devolve um SVG com `viewBox` e sem largura fixa, para
    // caber tanto na previa pequena do Control Room quanto na tela cheia do
    // projetor sem recalcular nada.
    return code.createSvgTag({ scalable: true });
  }, [payload]);

  return (
    <div
      role="img"
      aria-label="QR Code"
      className={cn('aspect-square max-w-full bg-white p-[6%]', className)}
      // O SVG vem de uma biblioteca que so' desenha modulos pretos e brancos
      // a partir do texto que o proprio operador digitou -- nao ha HTML de
      // terceiros nem entrada de usuario da congregacao envolvida aqui.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
