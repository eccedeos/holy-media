//! O motor de apresentacao.
//!
//! Este e' o pedaco do sistema que nao pode falhar ao vivo, entao ele e' o mais
//! simples possivel: **logica pura**. Sem banco, sem DOM, sem Tauri, sem
//! relogio. Recebe uma sequencia de slides e responde qual deve estar na tela.
//!
//! O isolamento nao e' purismo. E' o que permite cobrir por teste todo o
//! comportamento que o operador vai exercitar num culto -- incluindo os casos
//! que so aparecem sob pressao, como avancar slide com a tela preta.

use super::model::{Output, Presentation, PresentationState, SlideKind};

/// Estado da projecao.
#[derive(Debug, Default)]
pub struct PresentationEngine {
    loaded: Option<Presentation>,
    /// Posicao atual. So' tem sentido com algo carregado.
    index: usize,
    /// Tela preta pedida pelo operador. **Nao** apaga a posicao.
    blacked_out: bool,
}

impl PresentationEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Carrega uma sequencia e volta ao primeiro slide.
    ///
    /// A tela preta e' **preservada** de proposito: trocar de musica com a tela
    /// no preto e' o fluxo normal do operador -- ele apaga, prepara a proxima e
    /// so' entao mostra. Se carregar reacendesse a tela, a congregacao veria a
    /// preparacao.
    pub fn load(&mut self, presentation: Presentation) {
        self.loaded = Some(presentation);
        self.index = 0;
    }

    /// Descarrega tudo. A tela volta para o estado de espera.
    pub fn clear(&mut self) {
        self.loaded = None;
        self.index = 0;
    }

    /// Avanca um slide. Devolve `true` se a posicao mudou.
    ///
    /// **Nao circula** ao chegar no fim: voltar sozinho para o primeiro verso no
    /// meio de um culto seria pior do que nao fazer nada.
    pub fn next(&mut self) -> bool {
        if self.index + 1 < self.total() {
            self.index += 1;
            return true;
        }
        false
    }

    /// Volta um slide. Nao circula, pelo mesmo motivo.
    pub fn previous(&mut self) -> bool {
        if self.index > 0 {
            self.index -= 1;
            return true;
        }
        false
    }

    pub fn first(&mut self) -> bool {
        self.go_to(0)
    }

    pub fn last(&mut self) -> bool {
        match self.total() {
            0 => false,
            total => self.go_to(total - 1),
        }
    }

    /// Vai para uma posicao. Indice fora da faixa e' ignorado, nao truncado:
    /// um clique errado nao deve mandar a projecao para o fim da musica.
    pub fn go_to(&mut self, index: usize) -> bool {
        if index >= self.total() || index == self.index {
            return false;
        }
        self.index = index;
        true
    }

    /// Liga ou desliga a tela preta. Devolve o novo estado.
    ///
    /// A posicao continua onde estava: o operador apaga a tela, navega ate' o
    /// slide certo e reacende ja no lugar.
    /// (Nao ha um `set_blackout(bool)` ainda de proposito. Ele so' faz falta
    /// quando houver mais de um cliente -- o celular da Fase 3 -- porque dois
    /// toggles simultaneos se cancelam. Com um operador so', o toggle basta.)
    pub fn toggle_blackout(&mut self) -> bool {
        self.blacked_out = !self.blacked_out;
        self.blacked_out
    }

    fn total(&self) -> usize {
        self.loaded.as_ref().map_or(0, |p| p.slides.len())
    }

    /// Retrato do motor. E' o unico jeito de ler o estado.
    pub fn state(&self) -> PresentationState {
        let total = self.total();
        let current = self.loaded.as_ref().and_then(|p| p.slides.get(self.index));

        let output = if self.blacked_out {
            Output::Black
        } else {
            match current {
                Some(slide) => match slide.kind {
                    SlideKind::Text => Output::Slide {
                        content: slide.content.clone(),
                    },
                    SlideKind::Qr => Output::Qr {
                        content: slide.content.clone(),
                    },
                },
                None => Output::Idle,
            }
        };

        PresentationState {
            output,
            source_id: self.loaded.as_ref().map(|p| p.source_id.clone()),
            title: self
                .loaded
                .as_ref()
                .map_or(String::new(), |p| p.title.clone()),
            label: current.map_or(String::new(), |slide| slide.label.clone()),
            index: self.index,
            total,
            blacked_out: self.blacked_out,
            can_go_next: self.index + 1 < total,
            can_go_previous: self.index > 0,
        }
    }
}
