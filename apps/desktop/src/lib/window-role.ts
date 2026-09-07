/**
 * Que papel esta janela desempenha.
 *
 * O nucleo injeta `window.__HOLY_MEDIA_ROLE__` antes de qualquer script da
 * pagina, de forma **sincrona**. Ler o rotulo pela API do Tauri seria
 * assincrono, e a projecao piscaria o Control Room por um quadro antes de se
 * corrigir -- na frente da igreja inteira.
 *
 * O `#projection` no endereco existe para desenvolver a tela de projecao no
 * navegador, com `pnpm dev`, sem precisar do Tauri.
 */

export type WindowRole = 'control-room' | 'projection';

declare global {
  interface Window {
    __HOLY_MEDIA_ROLE__?: string;
  }
}

export function currentWindowRole(): WindowRole {
  if (typeof window === 'undefined') return 'control-room';
  if (window.__HOLY_MEDIA_ROLE__ === 'projection') return 'projection';
  if (window.location.hash === '#projection') return 'projection';
  return 'control-room';
}
