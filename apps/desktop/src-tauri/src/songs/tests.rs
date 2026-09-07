//! Testes de integracao do dominio de musicas, contra um SQLite real em
//! memoria. Nao ha mock: o que esta sendo verificado e' justamente o SQL, as
//! chaves estrangeiras e o indice de busca.

use super::model::{SlideInput, SongInput};
use super::repository;
use crate::db::Database;
use crate::error::AppErrorCode;

fn banco() -> Database {
    Database::open_in_memory().expect("banco de teste deve abrir")
}

fn musica(title: &str) -> SongInput {
    SongInput {
        title: title.to_owned(),
        ..Default::default()
    }
}

fn musica_completa() -> SongInput {
    SongInput {
        title: "Grande e o Senhor".to_owned(),
        artist: "Adhemar de Campos".to_owned(),
        author: "Autor Desconhecido".to_owned(),
        category: "Adoracao".to_owned(),
        favorite: false,
        tags: vec!["Adoracao".to_owned(), "Classico".to_owned()],
        slides: vec![
            SlideInput {
                label: "Verso 1".to_owned(),
                content: "Grande e o Senhor e mui digno de louvor".to_owned(),
            },
            SlideInput {
                label: "Refrao".to_owned(),
                content: "Na cidade do nosso Deus, seu santo monte".to_owned(),
            },
        ],
    }
}

// --- criacao e leitura ----------------------------------------------------

#[test]
fn criar_devolve_a_musica_completa() {
    let db = banco();
    let song = repository::create(&db, musica_completa()).expect("deveria criar");

    assert!(!song.id.is_empty());
    assert_eq!(song.title, "Grande e o Senhor");
    assert_eq!(song.artist, "Adhemar de Campos");
    assert_eq!(song.slides.len(), 2);
    assert_eq!(
        song.tags,
        vec!["Adoracao".to_owned(), "Classico".to_owned()]
    );
    assert_eq!(song.created_at, song.updated_at);
}

#[test]
fn os_slides_guardam_a_ordem_de_projecao() {
    let db = banco();
    let song = repository::create(&db, musica_completa()).expect("deveria criar");

    assert_eq!(song.slides[0].position, 0);
    assert_eq!(song.slides[0].label, "Verso 1");
    assert_eq!(song.slides[1].position, 1);
    assert_eq!(song.slides[1].label, "Refrao");
}

#[test]
fn buscar_por_id_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let erro = repository::get(&db, "id-que-nao-existe").expect_err("deveria falhar");

    assert_eq!(erro.code, AppErrorCode::NotFound);
    assert_eq!(erro.message, "Musica nao encontrada.");
}

#[test]
fn titulo_vazio_nao_chega_ao_banco() {
    let db = banco();
    let erro = repository::create(&db, musica("   ")).expect_err("deveria recusar");

    assert_eq!(erro.code, AppErrorCode::InvalidInput);
    assert!(repository::search(&db, "").expect("busca").is_empty());
}

// --- edicao ---------------------------------------------------------------

#[test]
fn editar_substitui_slides_e_tags() {
    let db = banco();
    let criada = repository::create(&db, musica_completa()).expect("deveria criar");

    let editada = repository::update(
        &db,
        &criada.id,
        SongInput {
            title: "Grande e o Senhor".to_owned(),
            tags: vec!["Natal".to_owned()],
            slides: vec![SlideInput {
                label: "Unico".to_owned(),
                content: "Letra nova".to_owned(),
            }],
            ..Default::default()
        },
    )
    .expect("deveria editar");

    assert_eq!(editada.id, criada.id);
    assert_eq!(editada.slides.len(), 1);
    assert_eq!(editada.slides[0].content, "Letra nova");
    assert_eq!(editada.tags, vec!["Natal".to_owned()]);
    assert!(editada.updated_at >= criada.updated_at);
}

#[test]
fn editar_musica_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let erro = repository::update(&db, "sumida", musica("Titulo")).expect_err("deveria falhar");

    assert_eq!(erro.code, AppErrorCode::NotFound);
}

// --- exclusao -------------------------------------------------------------

#[test]
fn excluir_leva_junto_slides_tags_e_historico() {
    let db = banco();
    let song = repository::create(&db, musica_completa()).expect("deveria criar");
    repository::register_usage(&db, &song.id).expect("deveria registrar uso");

    repository::delete(&db, &song.id).expect("deveria excluir");

    let orfaos: i64 = db
        .with_connection(|c| {
            Ok(c.query_row(
                "SELECT (SELECT count(*) FROM song_slides)
                      + (SELECT count(*) FROM song_tags)
                      + (SELECT count(*) FROM song_usages)",
                [],
                |row| row.get(0),
            )?)
        })
        .expect("consulta");

    assert_eq!(orfaos, 0, "o ON DELETE CASCADE deveria ter limpado tudo");
}

#[test]
fn excluir_musica_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let erro = repository::delete(&db, "sumida").expect_err("deveria falhar");

    assert_eq!(erro.code, AppErrorCode::NotFound);
}

// --- busca ----------------------------------------------------------------

#[test]
fn busca_encontra_por_titulo() {
    let db = banco();
    repository::create(&db, musica_completa()).expect("deveria criar");
    repository::create(&db, musica("Outra Coisa")).expect("deveria criar");

    let encontradas = repository::search(&db, "grande").expect("busca");

    assert_eq!(encontradas.len(), 1);
    assert_eq!(encontradas[0].title, "Grande e o Senhor");
    assert_eq!(encontradas[0].slide_count, 2);
}

#[test]
fn busca_encontra_por_artista() {
    let db = banco();
    repository::create(&db, musica_completa()).expect("deveria criar");

    assert_eq!(repository::search(&db, "adhemar").expect("busca").len(), 1);
}

#[test]
fn busca_encontra_por_trecho_da_letra() {
    let db = banco();
    repository::create(&db, musica_completa()).expect("deveria criar");

    // Trecho que so existe no segundo slide -- prova que a letra inteira foi
    // indexada, e nao apenas o primeiro bloco.
    assert_eq!(
        repository::search(&db, "santo monte").expect("busca").len(),
        1
    );
}

#[test]
fn busca_encontra_por_tag() {
    let db = banco();
    repository::create(&db, musica_completa()).expect("deveria criar");

    assert_eq!(repository::search(&db, "classico").expect("busca").len(), 1);
}

#[test]
fn busca_ignora_acentos_nos_dois_sentidos() {
    let db = banco();
    repository::create(
        &db,
        SongInput {
            title: "Coração Cheio de Louvor".to_owned(),
            ..Default::default()
        },
    )
    .expect("deveria criar");

    // O operador com pressa digita sem acento.
    assert_eq!(repository::search(&db, "coracao").expect("busca").len(), 1);
    // E quem digita com acento tambem encontra.
    assert_eq!(repository::search(&db, "coração").expect("busca").len(), 1);
}

#[test]
fn busca_filtra_por_prefixo_enquanto_se_digita() {
    let db = banco();
    repository::create(&db, musica("Aleluia")).expect("deveria criar");

    // Cada estado intermediario da digitacao ja precisa encontrar.
    for parcial in ["a", "al", "alel", "alelui", "aleluia"] {
        assert_eq!(
            repository::search(&db, parcial).expect("busca").len(),
            1,
            "a busca deveria encontrar com '{parcial}' digitado",
        );
    }
}

#[test]
fn busca_exige_todos_os_termos() {
    let db = banco();
    repository::create(&db, musica("Grande e o Senhor")).expect("deveria criar");
    repository::create(&db, musica("Senhor Te Quero")).expect("deveria criar");

    assert_eq!(repository::search(&db, "senhor").expect("busca").len(), 2);
    assert_eq!(
        repository::search(&db, "grande senhor")
            .expect("busca")
            .len(),
        1
    );
}

#[test]
fn o_titulo_pesa_mais_que_a_letra_no_ranking() {
    let db = banco();
    repository::create(
        &db,
        SongInput {
            title: "Outra Musica".to_owned(),
            slides: vec![SlideInput {
                label: String::new(),
                content: "aleluia aleluia aleluia".to_owned(),
            }],
            ..Default::default()
        },
    )
    .expect("deveria criar");
    repository::create(&db, musica("Aleluia")).expect("deveria criar");

    let encontradas = repository::search(&db, "aleluia").expect("busca");

    assert_eq!(encontradas.len(), 2);
    assert_eq!(
        encontradas[0].title, "Aleluia",
        "quem digita 'aleluia' procura a musica com esse nome",
    );
}

#[test]
fn busca_com_pontuacao_nao_quebra() {
    let db = banco();
    repository::create(&db, musica("Grande e o Senhor")).expect("deveria criar");

    // Entradas que estourariam um MATCH montado por concatenacao.
    for entrada in [
        "grande e' o",
        "NEAR",
        "\"",
        "a\" OR b",
        "(((",
        "*",
        "senhor:",
    ] {
        repository::search(&db, entrada)
            .unwrap_or_else(|e| panic!("a busca por {entrada:?} nao deveria falhar: {e}"));
    }
}

#[test]
fn busca_vazia_lista_a_biblioteca_pela_edicao_mais_recente() {
    let db = banco();
    let primeira = repository::create(&db, musica("Primeira")).expect("deveria criar");
    repository::create(&db, musica("Segunda")).expect("deveria criar");
    // Editar a primeira deve traze-la para o topo.
    repository::update(&db, &primeira.id, musica("Primeira")).expect("deveria editar");

    let listadas = repository::search(&db, "").expect("busca");

    assert_eq!(listadas.len(), 2);
    assert_eq!(listadas[0].title, "Primeira");
}

#[test]
fn musica_excluida_some_do_indice_de_busca() {
    let db = banco();
    let song = repository::create(&db, musica_completa()).expect("deveria criar");
    repository::delete(&db, &song.id).expect("deveria excluir");

    assert!(
        repository::search(&db, "grande").expect("busca").is_empty(),
        "o indice de busca ficou com uma musica que nao existe mais",
    );
}

#[test]
fn musica_editada_e_reindexada() {
    let db = banco();
    let song = repository::create(&db, musica("Titulo Antigo")).expect("deveria criar");
    repository::update(&db, &song.id, musica("Titulo Novo")).expect("deveria editar");

    assert!(repository::search(&db, "antigo").expect("busca").is_empty());
    assert_eq!(repository::search(&db, "novo").expect("busca").len(), 1);
}

// --- favoritos e historico ------------------------------------------------

#[test]
fn favorito_alterna_e_devolve_o_novo_estado() {
    let db = banco();
    let song = repository::create(&db, musica("Musica")).expect("deveria criar");

    assert!(repository::toggle_favorite(&db, &song.id).expect("alternar"));
    assert_eq!(repository::list_favorites(&db).expect("favoritas").len(), 1);

    assert!(!repository::toggle_favorite(&db, &song.id).expect("alternar"));
    assert!(repository::list_favorites(&db)
        .expect("favoritas")
        .is_empty());
}

#[test]
fn usadas_recentemente_nao_repete_a_mesma_musica() {
    let db = banco();
    let primeira = repository::create(&db, musica("Primeira")).expect("deveria criar");
    let segunda = repository::create(&db, musica("Segunda")).expect("deveria criar");

    repository::register_usage(&db, &primeira.id).expect("uso");
    repository::register_usage(&db, &segunda.id).expect("uso");
    repository::register_usage(&db, &primeira.id).expect("uso");

    let recentes = repository::list_recently_used(&db, 10).expect("recentes");

    assert_eq!(
        recentes.len(),
        2,
        "a mesma musica nao pode ocupar duas linhas"
    );
    assert_eq!(recentes[0].title, "Primeira");
}

#[test]
fn registrar_uso_de_musica_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let erro = repository::register_usage(&db, "sumida").expect_err("deveria falhar");

    assert_eq!(erro.code, AppErrorCode::NotFound);
}

// --- tags -----------------------------------------------------------------

#[test]
fn a_mesma_tag_em_caixas_diferentes_nao_duplica_na_biblioteca() {
    let db = banco();
    repository::create(
        &db,
        SongInput {
            title: "Primeira".to_owned(),
            tags: vec!["Natal".to_owned()],
            ..Default::default()
        },
    )
    .expect("deveria criar");
    repository::create(
        &db,
        SongInput {
            title: "Segunda".to_owned(),
            tags: vec!["natal".to_owned()],
            ..Default::default()
        },
    )
    .expect("deveria criar");

    let total: i64 = db
        .with_connection(|c| Ok(c.query_row("SELECT count(*) FROM tags", [], |r| r.get(0))?))
        .expect("consulta");

    assert_eq!(total, 1, "'Natal' e 'natal' sao a mesma tag");
}

// --- performance ----------------------------------------------------------

/// O orcamento de `docs/performance.md`: busca abaixo de 50 ms numa biblioteca
/// de 5000 musicas. E' o numero que sustenta a promessa de "busca instantanea",
/// entao ele e' medido, nao presumido.
///
/// O limite do teste e' folgado de proposito (250 ms) porque ele roda tambem em
/// build de debug e em CI compartilhada; o valor real em release fica uma ordem
/// de grandeza abaixo. O que este teste protege e' a *ordem de grandeza*: se
/// alguem trocar o FTS5 por um LIKE '%...%', ele quebra.
#[test]
fn busca_em_biblioteca_grande_continua_rapida() {
    use std::time::Instant;

    const TOTAL: usize = 5_000;
    const LIMITE: std::time::Duration = std::time::Duration::from_millis(250);

    let db = banco();

    for indice in 0..TOTAL {
        repository::create(
            &db,
            SongInput {
                title: format!("Musica numero {indice}"),
                artist: format!("Artista {}", indice % 200),
                tags: vec![format!("tag{}", indice % 50)],
                slides: vec![
                    SlideInput {
                        label: "Verso 1".to_owned(),
                        content: format!("Primeira estrofe da musica {indice}, com louvor"),
                    },
                    SlideInput {
                        label: "Refrao".to_owned(),
                        content: format!("Refrao numero {indice} cantado pela congregacao"),
                    },
                ],
                ..Default::default()
            },
        )
        .expect("deveria criar");
    }

    // Termo que aparece em toda a biblioteca: e' o pior caso para o ranking,
    // porque o FTS5 precisa ordenar o conjunto inteiro.
    let inicio = Instant::now();
    let encontradas = repository::search(&db, "louvor").expect("busca");
    let decorrido = inicio.elapsed();

    assert!(!encontradas.is_empty());
    assert!(
        decorrido < LIMITE,
        "busca em {TOTAL} musicas levou {decorrido:?}, acima do limite de {LIMITE:?}",
    );
    println!("busca em {TOTAL} musicas: {decorrido:?}");
}
