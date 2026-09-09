-- Migration 0003 -- Biblia: traducoes, livros e versiculos.
--
-- Este projeto NAO distribui nenhuma traducao biblica junto com o instalador
-- (ver docs/bible.md para o motivo). O que existe aqui e' o mecanismo:
-- importar um arquivo de traducao que a igreja ja possua os direitos de usar,
-- ou que esteja verificadamente em dominio publico. As tabelas nascem vazias
-- e so' recebem conteudo por importacao.

CREATE TABLE bible_translations (
    id           TEXT    PRIMARY KEY,
    abbreviation TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name         TEXT    NOT NULL,
    language     TEXT    NOT NULL,
    imported_at  INTEGER NOT NULL
) STRICT;

-- `position` e' a ordem canonica (Genesis = 1, Apocalipse = 66 numa Biblia
-- protestante) -- e' o que ordena a lista de livros na interface e desempata
-- a busca, e nao depende de closest guess por nome.
CREATE TABLE bible_books (
    id             TEXT    PRIMARY KEY,
    translation_id TEXT    NOT NULL REFERENCES bible_translations (id) ON DELETE CASCADE,
    position       INTEGER NOT NULL,
    name           TEXT    NOT NULL,
    abbreviation   TEXT    NOT NULL,
    chapter_count  INTEGER NOT NULL,
    UNIQUE (translation_id, position)
) STRICT;

CREATE INDEX idx_bible_books_translation ON bible_books (translation_id, position);

-- Nao ha tabela de capitulos: um capitulo e' so' um agrupamento de versiculos
-- por numero, e nao carrega metadado proprio. Criar a tabela so' para isso
-- seria estrutura sem uso.
CREATE TABLE bible_verses (
    id      TEXT    PRIMARY KEY,
    book_id TEXT    NOT NULL REFERENCES bible_books (id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    verse   INTEGER NOT NULL,
    text    TEXT    NOT NULL,
    UNIQUE (book_id, chapter, verse)
) STRICT;

CREATE INDEX idx_bible_verses_book_chapter ON bible_verses (book_id, chapter);

-- Mesmo tokenizador do indice de musicas, e pelo mesmo motivo:
-- remove_diacritics 2 deixa "joao 3 16" encontrar "João" mesmo sem acento.
CREATE VIRTUAL TABLE bible_verses_fts USING fts5 (
    verse_id UNINDEXED,
    text,
    tokenize = "unicode61 remove_diacritics 2"
);
