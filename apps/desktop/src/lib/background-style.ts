import type { BackgroundSettings } from '@holy-media/types';
import type { CSSProperties } from 'react';

/**
 * Traduz o fundo configurado em estilo CSS.
 *
 * Compartilhado entre a tela de projecao e a previa: a previa so' nao mente
 * sobre o fundo real se as duas usarem exatamente a mesma conta.
 */
export function backgroundStyle(settings: BackgroundSettings): CSSProperties {
  switch (settings.kind) {
    case 'gradient':
      return {
        background: `linear-gradient(${settings.gradientAngle ?? 180}deg, ${
          settings.gradientFrom ?? '#000000'
        }, ${settings.gradientTo ?? '#000000'})`,
      };
    case 'image':
      return settings.imageData === null
        ? { backgroundColor: '#000000' }
        : {
            backgroundImage: `url(${settings.imageData})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          };
    case 'color':
    default:
      return { backgroundColor: settings.color ?? '#000000' };
  }
}
