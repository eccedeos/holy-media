import { describe, expect, it } from 'vitest';
import { fromLegacyFormat, parseImportFile } from './bible-import';

const NATIVO = {
  abbreviation: 'EX',
  name: 'Tradução de Exemplo',
  language: 'pt-BR',
  books: [{ name: 'Livro Um', abbreviation: 'L1', chapters: [['Um versiculo.']] }],
};

const LEGADO = [
  { abbrev: 'gn', name: 'Gênesis', chapters: [['No princípio...', 'Segundo versiculo.']] },
  { abbrev: 'ex', name: 'Êxodo', chapters: [['Primeiro versiculo do exodo.']] },
];

describe('parseImportFile', () => {
  it('reconhece o formato nativo (objeto com books/abbreviation/name/language)', () => {
    const resultado = parseImportFile(NATIVO);
    expect(resultado).toEqual({ kind: 'native', input: NATIVO });
  });

  it('reconhece o formato legado (array de {abbrev, name, chapters})', () => {
    const resultado = parseImportFile(LEGADO);
    expect(resultado).toEqual({ kind: 'legacy', books: LEGADO });
  });

  it('aceita o campo alternativo "book" no lugar de "name"', () => {
    const comBook = [{ abbrev: 'gn', book: 'Gênesis', chapters: [['Um versiculo.']] }];
    expect(parseImportFile(comBook)).toEqual({ kind: 'legacy', books: comBook });
  });

  it('array vazio nao e um formato legado valido -- nao ha livro para importar', () => {
    expect(parseImportFile([])).toEqual({ kind: 'invalid' });
  });

  it('json que nao e nem objeto nem array e invalido', () => {
    expect(parseImportFile('uma string qualquer')).toEqual({ kind: 'invalid' });
    expect(parseImportFile(42)).toEqual({ kind: 'invalid' });
    expect(parseImportFile(null)).toEqual({ kind: 'invalid' });
  });

  it('array de itens sem abbrev/chapters nao e reconhecido como legado', () => {
    expect(parseImportFile([{ titulo: 'nao e um livro' }])).toEqual({ kind: 'invalid' });
  });

  it('objeto parecido mas faltando um campo do nativo nao e reconhecido', () => {
    const semLanguage = { abbreviation: 'EX', name: 'Exemplo', books: [] };
    // Nao e nativo (falta language) nem legado (nao e array) -- invalido.
    expect(parseImportFile(semLanguage)).toEqual({ kind: 'invalid' });
  });
});

describe('fromLegacyFormat', () => {
  it('usa os metadados fornecidos e converte abbrev -> abbreviation', () => {
    const resultado = fromLegacyFormat(LEGADO, {
      abbreviation: 'NVI',
      name: 'Nova Versao Internacional',
      language: 'pt-BR',
    });

    expect(resultado.abbreviation).toBe('NVI');
    expect(resultado.name).toBe('Nova Versao Internacional');
    expect(resultado.language).toBe('pt-BR');
    expect(resultado.books).toHaveLength(2);
    expect(resultado.books[0]).toEqual({
      name: 'Gênesis',
      abbreviation: 'gn',
      chapters: [['No princípio...', 'Segundo versiculo.']],
    });
  });

  it('usa "book" quando "name" nao existe', () => {
    const resultado = fromLegacyFormat([{ abbrev: 'gn', book: 'Gênesis', chapters: [['x']] }], {
      abbreviation: 'X',
      name: 'X',
      language: 'pt-BR',
    });
    expect(resultado.books[0]?.name).toBe('Gênesis');
  });
});
