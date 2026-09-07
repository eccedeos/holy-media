import { describe, expect, it } from 'vitest';
import { formatLyrics, parseLyrics, parseTags } from './lyrics';

describe('parseLyrics', () => {
  it('separa estrofes por linha em branco', () => {
    const slides = parseLyrics('Primeira estrofe\nsegunda linha\n\nOutra estrofe');

    expect(slides).toEqual([
      { label: '', content: 'Primeira estrofe\nsegunda linha' },
      { label: '', content: 'Outra estrofe' },
    ]);
  });

  it('reconhece rotulo entre colchetes', () => {
    const slides = parseLyrics('[Verso 1]\nPrimeira linha\n\n[Refrao]\nAleluia');

    expect(slides).toEqual([
      { label: 'Verso 1', content: 'Primeira linha' },
      { label: 'Refrao', content: 'Aleluia' },
    ]);
  });

  it('reconhece rotulo terminado em dois-pontos', () => {
    expect(parseLyrics('Refrao:\nAleluia')).toEqual([{ label: 'Refrao', content: 'Aleluia' }]);
  });

  it('nao transforma uma linha da letra em rotulo de slide vazio', () => {
    // Sem corpo depois, "Ouve:" e' a propria letra, nao uma marcacao.
    expect(parseLyrics('Ouve:')).toEqual([{ label: '', content: 'Ouve:' }]);
    expect(parseLyrics('[Verso 1]')).toEqual([{ label: '', content: '[Verso 1]' }]);
  });

  it('tolera varias linhas em branco e espacos entre estrofes', () => {
    const slides = parseLyrics('Primeira\n\n   \n\nSegunda');

    expect(slides).toHaveLength(2);
    expect(slides[1]?.content).toBe('Segunda');
  });

  it('aceita quebra de linha do Windows', () => {
    expect(parseLyrics('Primeira\r\n\r\nSegunda')).toHaveLength(2);
  });

  it('descarta blocos vazios em vez de projetar tela em branco', () => {
    expect(parseLyrics('')).toEqual([]);
    expect(parseLyrics('\n\n   \n\n')).toEqual([]);
  });

  it('preserva a quebra de linha dentro da estrofe', () => {
    const slides = parseLyrics('Linha um\nLinha dois\nLinha tres');

    expect(slides[0]?.content).toBe('Linha um\nLinha dois\nLinha tres');
  });
});

describe('formatLyrics', () => {
  it('devolve o texto do editor com os rotulos entre colchetes', () => {
    const texto = formatLyrics([
      { label: 'Verso 1', content: 'Primeira linha' },
      { label: '', content: 'Sem rotulo' },
    ]);

    expect(texto).toBe('[Verso 1]\nPrimeira linha\n\nSem rotulo');
  });

  it('faz ida e volta sem perder nada', () => {
    const original = '[Verso 1]\nPrimeira linha\nsegunda linha\n\n[Refrao]\nAleluia';

    expect(formatLyrics(parseLyrics(original))).toBe(original);
  });
});

describe('parseTags', () => {
  it('separa por virgula e apara espacos', () => {
    expect(parseTags(' Natal , ceia ')).toEqual(['Natal', 'ceia']);
  });

  it('ignora entradas vazias', () => {
    expect(parseTags('Natal,,  ,ceia')).toEqual(['Natal', 'ceia']);
    expect(parseTags('')).toEqual([]);
  });
});
