-- Migration 0001 -- biblioteca de musicas.
--
-- Convencoes que valem para todas as tabelas do projeto:
--   * id e' TEXT com UUID v7 (unico globalmente, ordenado no tempo). Isso e' o
--     que permite sincronizar entre maquinas na Fase 5 sem colisao de id.
--   * created_at / updated_at sao INTEGER em milissegundos desde a epoca. Sem
--     dependencia de biblioteca de data, e `new Date(ms)` do lado TypeScript.
--   * boolean e' INTEGER 0/1, que e' como o SQLite representa.

CREATE TABLE songs (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL,
    artist     TEXT    NOT NULL DEFAULT '',
    author     TEXT    NOT NULL DEFAULT '',
    category   TEXT    NOT NULL DEFAULT '',
    favorite   INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_songs_title ON songs (title);
CREATE INDEX idx_songs_updated_at ON songs (updated_at DESC);

-- Um slide e' o que aparece de uma vez na tela. `position` e' a ordem de
-- projecao; `label` e' a marcacao que o operador le na lateral ("Refrao").
CREATE TABLE song_slides (
    id       TEXT    PRIMARY KEY,
    song_id  TEXT    NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    label    TEXT    NOT NULL DEFAULT '',
    content  TEXT    NOT NULL,
    UNIQUE (song_id, position)
) STRICT;

CREATE INDEX idx_song_slides_song ON song_slides (song_id, position);

CREATE TABLE tags (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

CREATE TABLE song_tags (
    song_id TEXT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    tag_id  TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (song_id, tag_id)
) STRICT;

CREATE INDEX idx_song_tags_tag ON song_tags (tag_id);

-- Historico de uso: alimenta "usadas recentemente" sem precisar varrer nada.
CREATE TABLE song_usages (
    id      TEXT    PRIMARY KEY,
    song_id TEXT    NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    used_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_song_usages_song ON song_usages (song_id, used_at DESC);

-- Indice de busca.
--
-- `remove_diacritics 2` e' o detalhe que faz diferenca no uso real: o operador
-- digita "coracao" com pressa e precisa encontrar "coracao" escrito com til.
-- A tabela nao e' `external content` de proposito -- a letra indexada e' a
-- concatenacao dos slides, que nao existe como coluna em lugar nenhum, entao
-- quem mantem a sincronia e' o repositorio, num unico lugar.
CREATE VIRTUAL TABLE songs_fts USING fts5 (
    song_id UNINDEXED,
    title,
    artist,
    author,
    lyrics,
    tags,
    tokenize = "unicode61 remove_diacritics 2"
);
