//! Testes de integracao do dominio da Biblia, contra SQLite real em memoria.
//!
//! O texto usado aqui e' claramente ficticio ("Texto de exemplo..."), nunca
//! Escritura de verdade -- o mesmo cuidado do modulo em si: nada aqui deve
//! ser lido como uma citacao biblica real.

use super::model::{BibleBookImportInput, BibleImportInput};
use super::repository;
use crate::db::Database;
use crate::error::AppErrorCode;

fn banco() -> Database {
    Database::open_in_memory().expect("banco de teste deve abrir")
}

/// Traducao ficticia com dois livros: um de 3 capitulos (para exercitar
/// paginacao/capitulo) e um de 1 (para os casos de borda).
fn traducao_de_teste() -> BibleImportInput {
    BibleImportInput {
        abbreviation: "TST".to_owned(),
        name: "Traducao de Teste".to_owned(),
        language: "pt-BR".to_owned(),
        books: vec![
            BibleBookImportInput {
                name: "Primeiro Livro".to_owned(),
                abbreviation: "Pl".to_owned(),
                chapters: vec![
                    vec![
                        "Texto de exemplo 1:1".to_owned(),
                        "Texto de exemplo 1:2".to_owned(),
                        "Texto de exemplo com a palavra aleluia 1:3".to_owned(),
                    ],
                    vec!["Texto de exemplo 2:1".to_owned()],
                    vec![
                        "Texto de exemplo 3:1".to_owned(),
                        "Texto de exemplo 3:2".to_owned(),
                    ],
                ],
            },
            BibleBookImportInput {
                name: "Segundo Livro".to_owned(),
                abbreviation: "Sl2".to_owned(),
                chapters: vec![vec!["Unico versiculo do segundo livro".to_owned()]],
            },
        ],
    }
}

// --- importacao -----------------------------------------------------------

#[test]
fn importar_cria_traducao_livros_e_versiculos() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    assert_eq!(traducao.abbreviation, "TST");
    assert_eq!(traducao.name, "Traducao de Teste");

    let livros = repository::list_books(&db, &traducao.id).expect("livros");
    assert_eq!(livros.len(), 2);
    assert_eq!(livros[0].name, "Primeiro Livro");
    assert_eq!(livros[0].position, 0);
    assert_eq!(livros[0].chapter_count, 3);
    assert_eq!(livros[1].position, 1);
}

#[test]
fn capitulo_1_tem_os_tres_versiculos_na_ordem() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");
    let livros = repository::list_books(&db, &traducao.id).expect("livros");

    let versiculos = repository::get_chapter(&db, &livros[0].id, 1).expect("capitulo");

    assert_eq!(versiculos.len(), 3);
    assert_eq!(versiculos[0].verse, 1);
    assert_eq!(versiculos[2].verse, 3);
    assert_eq!(
        versiculos[2].text,
        "Texto de exemplo com a palavra aleluia 1:3"
    );
}

#[test]
fn sigla_repetida_e_recusada_com_mensagem_clara() {
    let db = banco();
    repository::import_translation(&db, traducao_de_teste()).expect("primeira importacao");

    let erro =
        repository::import_translation(&db, traducao_de_teste()).expect_err("deveria recusar");

    assert_eq!(erro.code, AppErrorCode::InvalidInput);
    assert!(
        erro.message.contains("TST"),
        "mensagem deveria citar a sigla: {}",
        erro.message
    );
}

#[test]
fn excluir_traducao_leva_junto_livros_e_versiculos() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    repository::delete_translation(&db, &traducao.id).expect("excluir");

    let orfaos: i64 = db
        .with_connection(|c| {
            Ok(c.query_row(
                "SELECT (SELECT count(*) FROM bible_books)
                      + (SELECT count(*) FROM bible_verses)",
                [],
                |row| row.get(0),
            )?)
        })
        .expect("consulta");
    assert_eq!(orfaos, 0, "ON DELETE CASCADE deveria ter limpado tudo");

    assert!(
        repository::search(&db, &traducao.id, "exemplo")
            .expect("busca")
            .is_empty(),
        "o indice de busca ficou com versiculo de uma traducao excluida",
    );
}

#[test]
fn excluir_traducao_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let erro = repository::delete_translation(&db, "sumida").expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

// --- busca ------------------------------------------------------------

#[test]
fn busca_encontra_por_palavra_na_traducao_certa() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let encontrados = repository::search(&db, &traducao.id, "aleluia").expect("busca");

    assert_eq!(encontrados.len(), 1);
    assert_eq!(encontrados[0].verse.verse, 3);
    assert_eq!(encontrados[0].book_name, "Primeiro Livro");
}

#[test]
fn busca_nao_atravessa_para_outra_traducao() {
    let db = banco();
    let t1 = repository::import_translation(&db, traducao_de_teste()).expect("importar t1");
    let mut segunda = traducao_de_teste();
    segunda.abbreviation = "TST2".to_owned();
    let t2 = repository::import_translation(&db, segunda).expect("importar t2");

    // "aleluia" existe nas duas (mesmo texto ficticio nas duas traducoes),
    // mas a busca deve ficar restrita a traducao pedida.
    assert_eq!(
        repository::search(&db, &t1.id, "aleluia")
            .expect("busca")
            .len(),
        1
    );
    assert_eq!(
        repository::search(&db, &t2.id, "aleluia")
            .expect("busca")
            .len(),
        1
    );
}

#[test]
fn busca_vazia_devolve_lista_vazia_em_vez_da_biblia_inteira() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    assert_eq!(
        repository::search(&db, &traducao.id, "   ").expect("busca"),
        Vec::new()
    );
}

// --- referencia ---------------------------------------------------------

#[test]
fn referencia_com_versiculo_unico() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let resultado =
        repository::resolve_reference(&db, &traducao.id, "Primeiro Livro 1:3").expect("resolver");

    assert_eq!(resultado.book.name, "Primeiro Livro");
    assert_eq!(resultado.chapter, 1);
    assert_eq!(resultado.verses.len(), 1);
    assert_eq!(
        resultado.verses[0].text,
        "Texto de exemplo com a palavra aleluia 1:3"
    );
}

#[test]
fn referencia_por_sigla_do_livro() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let resultado = repository::resolve_reference(&db, &traducao.id, "Pl 2:1").expect("resolver");
    assert_eq!(resultado.book.abbreviation, "Pl");
}

#[test]
fn referencia_sem_versiculo_devolve_o_capitulo_inteiro() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let resultado =
        repository::resolve_reference(&db, &traducao.id, "Primeiro Livro 1").expect("resolver");

    assert_eq!(resultado.verses.len(), 3);
}

#[test]
fn referencia_com_faixa_de_versiculos() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let resultado =
        repository::resolve_reference(&db, &traducao.id, "Primeiro Livro 3:1-2").expect("resolver");

    assert_eq!(resultado.verses.len(), 2);
}

#[test]
fn referencia_com_livro_desconhecido_devolve_nao_encontrado() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let erro = repository::resolve_reference(&db, &traducao.id, "Livro Que Nao Existe 1:1")
        .expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

#[test]
fn referencia_com_capitulo_alem_do_ultimo_e_invalida() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    // "Segundo Livro" so' tem 1 capitulo.
    let erro = repository::resolve_reference(&db, &traducao.id, "Segundo Livro 5:1")
        .expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::InvalidInput);
}

#[test]
fn referencia_mal_formada_e_invalida() {
    let db = banco();
    let traducao = repository::import_translation(&db, traducao_de_teste()).expect("importar");

    let erro = repository::resolve_reference(&db, &traducao.id, "isso nao e uma referencia")
        .expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::InvalidInput);
}

#[test]
fn referencia_ignora_acento_e_caixa_no_nome_do_livro() {
    let db = banco();
    let mut traducao_com_acento = traducao_de_teste();
    traducao_com_acento.books[0].name = "Levítico".to_owned();
    let traducao = repository::import_translation(&db, traducao_com_acento).expect("importar");

    let resultado =
        repository::resolve_reference(&db, &traducao.id, "levitico 1:1").expect("resolver");
    assert_eq!(resultado.book.name, "Levítico");
}
