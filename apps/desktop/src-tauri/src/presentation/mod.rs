//! Motor de apresentacao: decide o que a segunda tela mostra.

pub mod engine;
pub mod model;

#[cfg(test)]
mod tests;

pub use engine::PresentationEngine;
pub use model::{Presentation, PresentationSlide, PresentationState};
