//! Traducao do que o operador digita para uma consulta FTS5.
//!
//! Compartilhado entre os dominios que tem busca por texto -- musicas e
//! Biblia, e o proximo que precisar -- porque a seguranca desta funcao vale
//! igual para todos e uma segunda copia poderia divergir da primeira.
//!
//! O texto digitado **nunca** e' concatenado direto no `MATCH`. A sintaxe do
//! FTS5 tem operadores proprios (`AND`, `OR`, `NOT`, `NEAR`, aspas, parenteses,
//! `*`, `^`, `:`) e um `MATCH` com sintaxe invalida nao devolve zero
//! resultados: ele estoura um erro. Um operador que digitasse "grande e' o
//! senhor" -- com apostrofo -- veria a busca quebrar no meio do culto.
//!
//! A solucao e' extrair apenas os termos e reescrever a consulta do zero.

/// Converte texto livre em uma expressao FTS5 segura.
///
/// Devolve `None` quando nao sobra nenhum termo pesquisavel -- a busca por
/// "!!!" nao deve virar uma consulta vazia que casa com tudo.
///
/// O ultimo termo recebe `*` (prefixo) para que a lista filtre enquanto o
/// operador ainda esta digitando: "aleluj" ja encontra "aleluja".
pub fn build_match_query(input: &str) -> Option<String> {
    let terms: Vec<String> = input
        .split(|character: char| !character.is_alphanumeric())
        .filter(|term| !term.is_empty())
        .map(|term| term.to_lowercase())
        .collect();

    if terms.is_empty() {
        return None;
    }

    let last = terms.len() - 1;
    let expression = terms
        .iter()
        .enumerate()
        .map(|(index, term)| {
            // Aspas duplas transformam o termo em literal, neutralizando
            // qualquer palavra que colidisse com operador do FTS5.
            if index == last {
                format!("\"{term}\"*")
            } else {
                format!("\"{term}\"")
            }
        })
        .collect::<Vec<_>>()
        .join(" AND ");

    Some(expression)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn termo_simples_vira_prefixo() {
        assert_eq!(
            build_match_query("aleluia").as_deref(),
            Some("\"aleluia\"*")
        );
    }

    #[test]
    fn varios_termos_sao_exigidos_juntos() {
        assert_eq!(
            build_match_query("grande senhor").as_deref(),
            Some("\"grande\" AND \"senhor\"*"),
        );
    }

    #[test]
    fn pontuacao_e_apostrofo_nao_quebram_a_consulta() {
        // "Grande e' o Senhor" digitado com apostrofo -- o caso que quebraria
        // um MATCH montado por concatenacao.
        assert_eq!(
            build_match_query("grande e' o").as_deref(),
            Some("\"grande\" AND \"e\" AND \"o\"*"),
        );
    }

    #[test]
    fn operadores_do_fts5_sao_tratados_como_texto() {
        let query = build_match_query("NEAR OR NOT").expect("deve haver termos");
        assert_eq!(query, "\"near\" AND \"or\" AND \"not\"*");
        assert!(
            !query.contains("NEAR"),
            "operador nao pode escapar sem aspas"
        );
    }

    #[test]
    fn aspas_do_usuario_nao_escapam_do_literal() {
        // Aspas nao sao alfanumericas, entao somem na tokenizacao -- e' o que
        // impede o usuario de fechar o literal e injetar sintaxe.
        let query = build_match_query("a\" OR b:\"c").expect("deve haver termos");
        assert_eq!(query, "\"a\" AND \"or\" AND \"b\" AND \"c\"*");
    }

    #[test]
    fn texto_sem_termo_pesquisavel_nao_vira_consulta() {
        assert_eq!(build_match_query("   "), None);
        assert_eq!(build_match_query("!!! ??? ***"), None);
        assert_eq!(build_match_query(""), None);
    }

    #[test]
    fn acentos_sao_preservados_para_o_tokenizador_resolver() {
        // Quem dobra acento e' o `remove_diacritics 2` do indice, nos dois
        // lados. Mexer aqui quebraria a busca por texto acentuado.
        assert_eq!(
            build_match_query("coracao").as_deref(),
            Some("\"coracao\"*")
        );
        assert_eq!(
            build_match_query("coração").as_deref(),
            Some("\"coração\"*")
        );
    }
}
