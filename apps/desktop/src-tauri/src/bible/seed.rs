//! Traducao de exemplo, oferecida na primeira execucao.
//!
//! Unica excecao a regra de nao distribuir nenhuma traducao com o instalador
//! (ver `docs/bible.md`): a **Traducao Brasileira** (TB, Sociedade Biblica do
//! Brasil, 2010) e' explicitamente marcada como **dominio publico** pela
//! fonte de onde este arquivo foi obtido
//! (`damarals/biblias`, `data/canonical/TB/meta.json`:
//! `"license": "public-domain"`) -- e' a mesma verificacao que faltava
//! quando a decisao original foi tomada.
//!
//! O texto vem embutido (`include_str!`) como um arquivo `.json` no formato
//! nativo de importacao (`BibleImportInput`), gerado uma vez a partir da
//! fonte publica e comitado neste repositorio -- nao baixado em tempo de
//! execucao. O aplicativo continua funcionando totalmente offline.
//!
//! Mesma logica do `songs::seed`: o seed **nao roda sozinho**. A tela vazia
//! oferece o botao, e o comando se recusa se ja houver qualquer traducao
//! importada -- mesmo raciocinio de nao substituir dado do operador sem
//! ele pedir.

use crate::error::{AppError, AppResult};

use super::model::BibleImportInput;

/// JSON gerado a partir de `damarals/biblias` (MIT, texto de dominio
/// publico) -- ver o comentario do modulo.
const TB_JSON: &str = include_str!("assets/tb.json");

/// A Traducao Brasileira, pronta para `repository::import_translation`.
pub fn public_domain_translation() -> AppResult<BibleImportInput> {
    serde_json::from_str(TB_JSON).map_err(|error| {
        // So' aconteceria se o arquivo embutido fosse corrompido na
        // compilacao -- um erro de build, nunca algo que o operador causou.
        AppError::new(
            crate::error::AppErrorCode::DatabaseFailed,
            "Nao foi possivel carregar a traducao de exemplo.",
        )
        .with_detail(error.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_traducao_embutida_carrega_e_passa_na_validacao_do_dominio() {
        let input = public_domain_translation().expect("deve carregar");
        assert_eq!(input.abbreviation, "TB");
        input.validated().expect("deve validar");
    }

    #[test]
    fn a_traducao_embutida_tem_os_sessenta_e_seis_livros_do_canone() {
        let input = public_domain_translation().expect("deve carregar");
        assert_eq!(input.books.len(), 66);
    }
}
