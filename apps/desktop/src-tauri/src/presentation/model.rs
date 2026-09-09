//! Tipos do motor de apresentacao.
//!
//! Cada struct daqui tem espelho em `@holy-media/types`.

use serde::{Deserialize, Serialize};

/// Como o `content` de um slide deve aparecer na tela.
///
/// Isto **nao** e' o motor conhecendo musica, Biblia ou QR Code -- e' o
/// motor conhecendo *formas* de exibir texto, do mesmo jeito que ja distingue
/// `Idle`/`Black`/`Slide` em `Output`. `Qr` existe porque um payload de PIX
/// nao deve virar texto gigante na tela: ele precisa ser desenhado como
/// codigo, e so a camada de renderizacao (fora do motor) sabe fazer isso.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SlideKind {
    #[default]
    Text,
    Qr,
}

/// Um slide ja resolvido, pronto para projetar.
///
/// O motor recebe isto e nao sabe de onde veio: musica, versiculo, texto livre
/// ou QR Code. E' o que permite acrescentar novos tipos de conteudo sem tocar
/// no motor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresentationSlide {
    /// Marcacao para o operador ("Verso 1", "Joao 3:16"). Nao vai para a tela.
    pub label: String,
    /// O que a congregacao le.
    pub content: String,
    #[serde(default)]
    pub kind: SlideKind,
}

impl PresentationSlide {
    pub fn new(label: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            content: content.into(),
            kind: SlideKind::Text,
        }
    }

    /// Um slide cujo `content` e' o payload a codificar como QR Code, nao
    /// texto a projetar literalmente.
    pub fn new_qr(label: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            content: content.into(),
            kind: SlideKind::Qr,
        }
    }
}

/// Sequencia carregada no motor.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Presentation {
    /// Id da origem (a musica, o versiculo). Serve para o Control Room saber o
    /// que esta no ar; o motor so' carrega junto.
    pub source_id: String,
    /// Titulo mostrado ao operador -- nunca projetado.
    pub title: String,
    pub slides: Vec<PresentationSlide>,
}

/// O que a segunda tela deve exibir **neste instante**.
///
/// E' a unica saida do motor. A janela de projecao renderiza isto e nada mais:
/// ela nao consulta banco, nao conhece musica e nao decide nada.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Output {
    /// Nada carregado. A tela de espera aparece aqui (Fase 2).
    Idle,
    /// Tela preta deliberada, pedida pelo operador.
    Black,
    /// Conteudo no ar, para projetar como texto.
    Slide { content: String },
    /// Conteudo no ar, para desenhar como QR Code. `content` e' o payload
    /// (URL, texto de PIX), nunca o desenho -- quem sabe transformar payload
    /// em imagem e' a tela, nao o motor.
    Qr { content: String },
}

/// Retrato completo do motor, enviado ao Control Room e a segunda tela.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresentationState {
    /// O que vai para a projecao.
    pub output: Output,
    /// Id da origem no ar (a musica), para o Control Room destacar a linha na
    /// biblioteca. `None` quando nao ha nada carregado.
    pub source_id: Option<String>,
    /// Titulo do que esta carregado, para o operador se situar.
    pub title: String,
    /// Marcacao do slide atual ("Refrao"), para o operador.
    pub label: String,
    /// Posicao atual, base zero. Zero quando nao ha nada carregado.
    pub index: usize,
    pub total: usize,
    /// `true` quando o operador pediu tela preta. A posicao segue preservada.
    pub blacked_out: bool,
    pub can_go_next: bool,
    pub can_go_previous: bool,
}
