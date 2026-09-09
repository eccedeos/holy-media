//! Interpreta o que o operador digita como referencia biblica: "João 3:16",
//! "1 João 3:16-18", "Salmos 23".
//!
//! So' a estrutura e' resolvida aqui -- livro (como texto opaco), capitulo,
//! versiculo inicial e final. Descobrir *qual* livro esse texto significa
//! depende da traducao escolhida (livros diferentes podem ter nomes ou siglas
//! diferentes), entao isso e' trabalho do repositorio, nao deste modulo.

/// Referencia estruturada, antes de resolver o nome do livro contra uma
/// traducao especifica.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedReference {
    /// Texto do livro tal como digitado ("1 João", "Sl", "cantico dos canticos").
    pub book_query: String,
    pub chapter: i64,
    /// `None` quando a referencia e' so' o capitulo ("Salmos 23").
    pub verse_start: Option<i64>,
    /// `None` quando nao ha faixa ("João 3:16", so' um versiculo).
    pub verse_end: Option<i64>,
}

/// Interpreta o texto. Devolve `None` quando a estrutura nao bate com
/// `<livro> <capitulo>[:<versiculo>[-<versiculo final>]]`.
///
/// A divisao entre livro e capitulo usa o **ultimo** espaco do texto, nao o
/// primeiro -- e' o que permite nomes de livro com varias palavras ("1 João",
/// "Cantico dos Canticos") sem tratamento especial: seja qual for o numero de
/// palavras do nome, o capitulo/versiculo sempre e' o ultimo token.
pub fn parse_reference(input: &str) -> Option<ParsedReference> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return None;
    }

    let (book_part, locator_part) = trimmed.rsplit_once(' ')?;
    let book_query = book_part.trim();
    if book_query.is_empty() {
        return None;
    }

    let (chapter_str, verse_str) = match locator_part.split_once(':') {
        Some((chapter, verse)) => (chapter, Some(verse)),
        None => (locator_part, None),
    };

    let chapter: i64 = chapter_str.trim().parse().ok()?;
    if chapter <= 0 {
        return None;
    }

    let (verse_start, verse_end) = match verse_str {
        None => (None, None),
        Some(range) => match range.split_once('-') {
            Some((start, end)) => {
                let start: i64 = start.trim().parse().ok()?;
                let end: i64 = end.trim().parse().ok()?;
                if start <= 0 || end <= 0 {
                    return None;
                }
                (Some(start), Some(end))
            }
            None => {
                let verse: i64 = range.trim().parse().ok()?;
                if verse <= 0 {
                    return None;
                }
                (Some(verse), None)
            }
        },
    };

    Some(ParsedReference {
        book_query: book_query.to_owned(),
        chapter,
        verse_start,
        verse_end,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(input: &str) -> ParsedReference {
        parse_reference(input).unwrap_or_else(|| panic!("deveria interpretar {input:?}"))
    }

    #[test]
    fn livro_capitulo_e_versiculo() {
        let ref_ = parse("João 3:16");
        assert_eq!(ref_.book_query, "João");
        assert_eq!(ref_.chapter, 3);
        assert_eq!(ref_.verse_start, Some(16));
        assert_eq!(ref_.verse_end, None);
    }

    #[test]
    fn so_o_capitulo_sem_versiculo() {
        let ref_ = parse("Salmos 23");
        assert_eq!(ref_.book_query, "Salmos");
        assert_eq!(ref_.chapter, 23);
        assert_eq!(ref_.verse_start, None);
    }

    #[test]
    fn faixa_de_versiculos() {
        let ref_ = parse("João 3:16-18");
        assert_eq!(ref_.verse_start, Some(16));
        assert_eq!(ref_.verse_end, Some(18));
    }

    #[test]
    fn livro_com_numero_na_frente_nao_e_confundido_com_capitulo() {
        // O ultimo espaco separa livro de capitulo, nao o primeiro -- por
        // isso "1 João" inteiro vai para o livro, nao so' "João".
        let ref_ = parse("1 João 3:16");
        assert_eq!(ref_.book_query, "1 João");
        assert_eq!(ref_.chapter, 3);
    }

    #[test]
    fn livro_com_varias_palavras() {
        let ref_ = parse("Cantico dos Canticos 2:1");
        assert_eq!(ref_.book_query, "Cantico dos Canticos");
        assert_eq!(ref_.chapter, 2);
    }

    #[test]
    fn sigla_curta_de_livro() {
        let ref_ = parse("Sl 23");
        assert_eq!(ref_.book_query, "Sl");
        assert_eq!(ref_.chapter, 23);
    }

    #[test]
    fn espacos_extras_sao_tolerados() {
        let ref_ = parse("  João   3:16  ");
        assert_eq!(ref_.book_query, "João");
        assert_eq!(ref_.chapter, 3);
    }

    #[test]
    fn entrada_vazia_nao_e_referencia() {
        assert_eq!(parse_reference(""), None);
        assert_eq!(parse_reference("   "), None);
    }

    #[test]
    fn sem_livro_nao_e_referencia() {
        // Nenhum espaco no texto: nao ha como separar livro de capitulo.
        assert_eq!(parse_reference("3:16"), None);
        assert_eq!(parse_reference("Joao"), None);
    }

    #[test]
    fn capitulo_nao_numerico_nao_e_referencia() {
        assert_eq!(parse_reference("João tres"), None);
    }

    #[test]
    fn versiculo_nao_numerico_nao_e_referencia() {
        assert_eq!(parse_reference("João 3:dezesseis"), None);
    }

    #[test]
    fn capitulo_ou_versiculo_zero_ou_negativo_nao_e_referencia() {
        assert_eq!(parse_reference("João 0"), None);
        assert_eq!(parse_reference("João 3:0"), None);
        assert_eq!(parse_reference("João -1"), None);
        assert_eq!(parse_reference("João 3:1--5"), None);
    }

    #[test]
    fn dois_pontos_sem_versiculo_nao_e_referencia() {
        assert_eq!(parse_reference("João 3:"), None);
    }
}
