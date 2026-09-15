//! Busca de letra de musica num servico externo (lrclib.net).
//!
//! **Risco de direitos autorais aceito explicitamente pelo operador deste
//! projeto** -- nao e' uma decisao tecnica silenciosa. Duas fontes foram
//! avaliadas (ver `docs/lyrics.md`): o endpoint interno do lyrics.com (site
//! comercial, sem documentacao publica, historico de disputas sobre letras) e
//! o lrclib.net (software do servidor em licenca aberta, mas as letras que
//! ele indexa sao enviadas por usuarios, sem garantia de que quem enviou
//! tinha o direito de fazer isso). Ao contrario da Traducao Brasileira
//! embutida em `bible::seed` -- que tem uma fonte com metadado explicito de
//! dominio publico -- aqui nao ha essa verificacao. O lrclib.net foi
//! escolhido por ter o menor risco relativo dos dois.
//!
//! Por isso a letra encontrada e' so' uma sugestao: preenche o formulario de
//! cadastro, mas o operador confirma (ou edita) antes de salvar, exatamente
//! como se tivesse colado o texto manualmente -- a responsabilidade pelo
//! conteudo continua sendo de quem usa (README, "Sobre conteudo de
//! terceiros"). Nada e' salvo so' por ter sido buscado.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppErrorCode, AppResult};

const SEARCH_URL: &str = "https://lrclib.net/api/search";

/// Nao ha sentido em devolver mais candidatos do que um operador consegue
/// olhar numa lista de busca.
const MAX_RESULTS: usize = 20;

#[derive(Debug, Clone, Deserialize)]
struct RawResult {
    #[serde(rename = "trackName")]
    track_name: String,
    #[serde(rename = "artistName")]
    artist_name: String,
    #[serde(rename = "albumName")]
    album_name: Option<String>,
    #[serde(default)]
    instrumental: bool,
    #[serde(rename = "plainLyrics")]
    plain_lyrics: Option<String>,
}

/// Um resultado de busca de letra, pronto para preencher o formulario de
/// cadastro na interface.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LyricsSearchResult {
    pub track_name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub lyrics: String,
}

fn lyrics_error(detail: impl std::fmt::Display) -> AppError {
    AppError::new(
        AppErrorCode::LyricsSearchFailed,
        "Nao foi possivel buscar a letra. Verifique a conexao com a internet.",
    )
    .with_detail(detail.to_string())
}

/// Filtra e converte a resposta bruta do servico: descarta faixas
/// instrumentais e faixas sem letra de verdade (nenhuma delas ajudaria o
/// operador), e limita a quantidade devolvida.
///
/// Separado de `search` para ser testavel sem rede.
fn parse_results(body: &str) -> AppResult<Vec<LyricsSearchResult>> {
    let raw: Vec<RawResult> = serde_json::from_str(body).map_err(lyrics_error)?;

    Ok(raw
        .into_iter()
        .filter(|item| !item.instrumental)
        .filter_map(|item| {
            let lyrics = item.plain_lyrics?;
            if lyrics.trim().is_empty() {
                return None;
            }
            Some(LyricsSearchResult {
                track_name: item.track_name,
                artist_name: item.artist_name,
                album_name: item.album_name,
                lyrics,
            })
        })
        .take(MAX_RESULTS)
        .collect())
}

/// Busca letras por texto livre (titulo, artista, ou os dois juntos).
///
/// Nao verificavel neste ambiente de desenvolvimento (acesso a `lrclib.net`
/// bloqueado pelo proxy da sandbox) -- verificado o formato da resposta
/// contra a documentacao publica do servico, nao contra uma chamada real.
pub fn search(query: &str) -> AppResult<Vec<LyricsSearchResult>> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let response = ureq::get(SEARCH_URL)
        .query("q", trimmed)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .map_err(lyrics_error)?;

    let body = response.into_string().map_err(lyrics_error)?;
    parse_results(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn descarta_faixas_instrumentais_e_sem_letra() {
        let body = r#"[
            {"trackName": "Solo", "artistName": "A", "albumName": null, "instrumental": true, "plainLyrics": null},
            {"trackName": "Sem letra", "artistName": "B", "albumName": null, "instrumental": false, "plainLyrics": null},
            {"trackName": "So espacos", "artistName": "C", "albumName": null, "instrumental": false, "plainLyrics": "   "},
            {"trackName": "Boa", "artistName": "D", "albumName": "Album D", "instrumental": false, "plainLyrics": "Letra de verdade"}
        ]"#;

        let resultados = parse_results(body).expect("deve analisar");

        assert_eq!(resultados.len(), 1);
        assert_eq!(resultados[0].track_name, "Boa");
        assert_eq!(resultados[0].artist_name, "D");
        assert_eq!(resultados[0].album_name, Some("Album D".to_string()));
        assert_eq!(resultados[0].lyrics, "Letra de verdade");
    }

    #[test]
    fn lista_vazia_da_api_devolve_lista_vazia() {
        let resultados = parse_results("[]").expect("deve analisar");
        assert!(resultados.is_empty());
    }

    #[test]
    fn resposta_mal_formada_devolve_erro_classificado_em_vez_de_entrar_em_panico() {
        let erro = parse_results("nao e json valido").expect_err("deve falhar");
        assert_eq!(erro.code, AppErrorCode::LyricsSearchFailed);
    }

    #[test]
    fn limita_a_quantidade_de_resultados_devolvidos() {
        let item = |i: usize| {
            format!(
                r#"{{"trackName": "Faixa {i}", "artistName": "Artista", "albumName": null, "instrumental": false, "plainLyrics": "Letra {i}"}}"#
            )
        };
        let itens: Vec<String> = (0..(MAX_RESULTS + 5)).map(item).collect();
        let body = format!("[{}]", itens.join(","));

        let resultados = parse_results(&body).expect("deve analisar");

        assert_eq!(resultados.len(), MAX_RESULTS);
    }

    #[test]
    fn busca_vazia_nao_chama_a_rede_e_devolve_lista_vazia() {
        let resultados = search("   ").expect("nao deve tentar rede para busca vazia");
        assert!(resultados.is_empty());
    }
}
