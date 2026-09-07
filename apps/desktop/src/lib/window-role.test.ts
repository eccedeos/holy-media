import { afterEach, describe, expect, it } from 'vitest';
import { currentWindowRole } from './window-role';

afterEach(() => {
  delete window.__HOLY_MEDIA_ROLE__;
  window.location.hash = '';
});

describe('currentWindowRole', () => {
  it('e o Control Room por padrao', () => {
    expect(currentWindowRole()).toBe('control-room');
  });

  it('reconhece a marca que o nucleo injeta na janela de projecao', () => {
    window.__HOLY_MEDIA_ROLE__ = 'projection';
    expect(currentWindowRole()).toBe('projection');
  });

  it('aceita o endereco com #projection, para desenvolver no navegador', () => {
    window.location.hash = '#projection';
    expect(currentWindowRole()).toBe('projection');
  });

  it('ignora marca desconhecida em vez de quebrar', () => {
    window.__HOLY_MEDIA_ROLE__ = 'qualquer-outra-coisa';
    expect(currentWindowRole()).toBe('control-room');
  });
});
