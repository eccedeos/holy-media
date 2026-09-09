-- Migration 0004 -- fundo da projecao.
--
-- Configuracao global de fundo (cor solida, gradiente ou imagem) mostrada
-- atras de qualquer slide de conteudo. Uma linha so ("current"): a Fase 1
-- tem um operador so e um fundo no ar por vez. Multiplos fundos salvos para
-- trocar durante o culto ficam para quando isso for pedido de verdade -- ver
-- docs/background.md.

CREATE TABLE background_settings (
    id             TEXT    PRIMARY KEY CHECK (id = 'current'),
    kind           TEXT    NOT NULL CHECK (kind IN ('color', 'gradient', 'image')),
    color          TEXT,
    gradient_from  TEXT,
    gradient_to    TEXT,
    gradient_angle INTEGER,
    -- Imagem guardada como data URL (base64) direto no banco, nao como
    -- arquivo em disco: evita abrir uma nova superficie de permissao do
    -- Tauri (escopo de asset, capability por diretorio) so' para uma imagem
    -- de fundo. O limite de tamanho e' aplicado no Rust, nao aqui.
    image_data     TEXT,
    updated_at     INTEGER NOT NULL
) STRICT;

INSERT INTO background_settings (id, kind, color, updated_at)
VALUES ('current', 'color', '#000000', 0);
