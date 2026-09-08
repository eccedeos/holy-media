-- Migration 0002 -- ordem do culto.
--
-- Um "service" e' a playlist da secao 12 do briefing: a sequencia de itens
-- que o operador prepara antes do culto e percorre durante ele. Hoje o unico
-- tipo de item e' musica; os outros (Biblia, texto, imagem, QR Code) entram
-- nas fases em que forem implementados, e a coluna `kind` ja esta pronta pra
-- eles -- e' um TEXT, nao um enum fechado do SQLite.

CREATE TABLE services (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_services_updated_at ON services (updated_at DESC);

-- Um item da ordem do culto. `position` e' a ordem de execucao (base zero);
-- `reference_id` aponta para a entidade de origem (hoje, `songs.id`) quando o
-- item tiver uma. `title` e' copiado no momento em que o item entra na lista
-- -- se o operador renomear a musica depois, a ordem do culto ja preparada
-- continua legivel com o nome de quando foi montada.
CREATE TABLE service_items (
    id           TEXT    PRIMARY KEY,
    service_id   TEXT    NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    kind         TEXT    NOT NULL CHECK (kind IN ('song')),
    reference_id TEXT,
    title        TEXT    NOT NULL,
    UNIQUE (service_id, position)
) STRICT;

CREATE INDEX idx_service_items_service ON service_items (service_id, position);
