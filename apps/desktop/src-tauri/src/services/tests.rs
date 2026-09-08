//! Testes de integracao da ordem do culto, contra SQLite real em memoria.

use super::repository;
use crate::db::Database;
use crate::error::AppErrorCode;
use crate::services::model::ServiceInput;
use crate::songs::{repository as songs_repository, SongInput};

fn banco() -> Database {
    Database::open_in_memory().expect("banco de teste deve abrir")
}

fn culto(title: &str) -> ServiceInput {
    ServiceInput {
        title: title.to_owned(),
    }
}

fn musica_no_banco(db: &Database, title: &str) -> String {
    songs_repository::create(
        db,
        SongInput {
            title: title.to_owned(),
            ..Default::default()
        },
    )
    .expect("deveria criar musica")
    .id
}

// --- CRUD do culto ----------------------------------------------------

#[test]
fn criar_devolve_o_culto_vazio() {
    let db = banco();
    let service = repository::create(&db, culto("Culto de Domingo")).expect("deveria criar");

    assert!(!service.id.is_empty());
    assert_eq!(service.title, "Culto de Domingo");
    assert!(service.items.is_empty());
    assert_eq!(service.created_at, service.updated_at);
}

#[test]
fn titulo_vazio_e_recusado() {
    let db = banco();
    let erro = repository::create(&db, culto("   ")).expect_err("deveria recusar");
    assert_eq!(erro.code, AppErrorCode::InvalidInput);
}

#[test]
fn renomear_atualiza_o_titulo() {
    let db = banco();
    let service = repository::create(&db, culto("Rascunho")).expect("deveria criar");

    let renomeado =
        repository::rename(&db, &service.id, culto("Culto de Domingo")).expect("deveria renomear");

    assert_eq!(renomeado.title, "Culto de Domingo");
}

#[test]
fn renomear_culto_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let erro = repository::rename(&db, "sumido", culto("Titulo")).expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

#[test]
fn excluir_leva_junto_os_itens() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");
    let song_id = musica_no_banco(&db, "Aleluia");
    repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");

    repository::delete(&db, &service.id).expect("deveria excluir");

    let orfaos: i64 = db
        .with_connection(|c| {
            Ok(c.query_row("SELECT count(*) FROM service_items", [], |row| row.get(0))?)
        })
        .expect("consulta");
    assert_eq!(orfaos, 0, "ON DELETE CASCADE deveria ter limpado os itens");
}

#[test]
fn listar_ordena_pela_edicao_mais_recente() {
    let db = banco();
    let primeiro = repository::create(&db, culto("Primeiro")).expect("deveria criar");
    repository::create(&db, culto("Segundo")).expect("deveria criar");
    repository::rename(&db, &primeiro.id, culto("Primeiro")).expect("toca updated_at");

    let listados = repository::list(&db).expect("lista");

    assert_eq!(listados.len(), 2);
    assert_eq!(listados[0].title, "Primeiro");
}

// --- itens --------------------------------------------------------------

#[test]
fn adicionar_musica_cria_item_com_titulo_copiado() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");
    let song_id = musica_no_banco(&db, "Grande e o Senhor");

    let atualizado = repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");

    assert_eq!(atualizado.items.len(), 1);
    assert_eq!(atualizado.items[0].title, "Grande e o Senhor");
    assert_eq!(
        atualizado.items[0].reference_id.as_deref(),
        Some(song_id.as_str())
    );
    assert_eq!(atualizado.items[0].position, 0);
}

#[test]
fn o_titulo_copiado_nao_muda_se_a_musica_for_renomeada_depois() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");
    let song_id = musica_no_banco(&db, "Titulo Original");
    let atualizado = repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");

    songs_repository::update(
        &db,
        &song_id,
        SongInput {
            title: "Titulo Novo".to_owned(),
            ..Default::default()
        },
    )
    .expect("deveria editar a musica");

    let recarregado = repository::get(&db, &atualizado.id).expect("get");
    assert_eq!(
        recarregado.items[0].title, "Titulo Original",
        "a ordem do culto ja montada deve continuar legivel com o nome de quando foi preparada",
    );
}

#[test]
fn adicionar_musica_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");

    let erro = repository::add_song(&db, &service.id, "musica-sumida").expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

#[test]
fn adicionar_a_culto_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let song_id = musica_no_banco(&db, "Musica");

    let erro = repository::add_song(&db, "culto-sumido", &song_id).expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

#[test]
fn itens_entram_na_ordem_em_que_foram_adicionados() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");

    for titulo in ["Primeira", "Segunda", "Terceira"] {
        let song_id = musica_no_banco(&db, titulo);
        repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");
    }

    let recarregado = repository::get(&db, &service.id).expect("get");
    let titulos: Vec<&str> = recarregado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(titulos, ["Primeira", "Segunda", "Terceira"]);
    assert_eq!(
        recarregado
            .items
            .iter()
            .map(|i| i.position)
            .collect::<Vec<_>>(),
        [0, 1, 2],
    );
}

#[test]
fn remover_item_reempacota_as_posicoes() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");
    let mut ids = Vec::new();
    for titulo in ["Primeira", "Segunda", "Terceira"] {
        let song_id = musica_no_banco(&db, titulo);
        repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");
    }
    let atual = repository::get(&db, &service.id).expect("get");
    ids.extend(atual.items.iter().map(|i| i.id.clone()));

    // Remove o do meio: sem reempacotar, as posicoes ficariam 0 e 2, com um
    // buraco na sequencia.
    let atualizado = repository::remove_item(&db, &service.id, &ids[1]).expect("deveria remover");

    assert_eq!(atualizado.items.len(), 2);
    assert_eq!(atualizado.items[0].title, "Primeira");
    assert_eq!(atualizado.items[0].position, 0);
    assert_eq!(atualizado.items[1].title, "Terceira");
    assert_eq!(
        atualizado.items[1].position, 1,
        "nao deveria sobrar buraco na sequencia"
    );
}

#[test]
fn remover_item_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");

    let erro =
        repository::remove_item(&db, &service.id, "item-sumido").expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

#[test]
fn duplicar_insere_a_copia_logo_depois_do_original() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");
    for titulo in ["Primeira", "Segunda"] {
        let song_id = musica_no_banco(&db, titulo);
        repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");
    }
    let atual = repository::get(&db, &service.id).expect("get");
    let id_primeira = atual.items[0].id.clone();

    let atualizado =
        repository::duplicate_item(&db, &service.id, &id_primeira).expect("deveria duplicar");

    let titulos: Vec<&str> = atualizado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(
        titulos,
        ["Primeira", "Primeira", "Segunda"],
        "a copia deveria ficar logo depois do original, nao no fim da lista",
    );
}

#[test]
fn duplicar_com_varios_itens_depois_do_original_nao_colide() {
    // O bug real: com dois itens uma unica linha deslocava e nunca colidia
    // com nada; com tres ou mais, o deslocamento em massa colidia com o
    // UNIQUE (service_id, position) a meio caminho. So' apareceu rodando o
    // aplicativo de verdade com uma ordem do culto de tres musicas.
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");
    for titulo in ["Primeira", "Segunda", "Terceira"] {
        let song_id = musica_no_banco(&db, titulo);
        repository::add_song(&db, &service.id, &song_id).expect("deveria adicionar");
    }
    let atual = repository::get(&db, &service.id).expect("get");
    let id_primeira = atual.items[0].id.clone();

    let atualizado = repository::duplicate_item(&db, &service.id, &id_primeira)
        .expect("nao deveria colidir com o UNIQUE de posicao");

    let titulos: Vec<&str> = atualizado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(titulos, ["Primeira", "Primeira", "Segunda", "Terceira"]);
    assert_eq!(
        atualizado
            .items
            .iter()
            .map(|i| i.position)
            .collect::<Vec<_>>(),
        [0, 1, 2, 3],
        "as posicoes precisam ficar sequenciais, sem buraco nem repeticao",
    );
}

#[test]
fn duplicar_item_inexistente_devolve_nao_encontrado() {
    let db = banco();
    let service = repository::create(&db, culto("Culto")).expect("deveria criar");

    let erro =
        repository::duplicate_item(&db, &service.id, "item-sumido").expect_err("deveria falhar");
    assert_eq!(erro.code, AppErrorCode::NotFound);
}

// --- reordenar ------------------------------------------------------------

fn montar_culto_de_tres(db: &Database) -> (String, Vec<String>) {
    let service = repository::create(db, culto("Culto")).expect("deveria criar");
    for titulo in ["Primeira", "Segunda", "Terceira"] {
        let song_id = musica_no_banco(db, titulo);
        repository::add_song(db, &service.id, &song_id).expect("deveria adicionar");
    }
    let atual = repository::get(db, &service.id).expect("get");
    let ids = atual.items.iter().map(|i| i.id.clone()).collect();
    (service.id, ids)
}

#[test]
fn mover_para_frente_reordena_os_itens_entre_as_duas_posicoes() {
    let db = banco();
    let (service_id, ids) = montar_culto_de_tres(&db);

    // Move "Primeira" (posicao 0) para o fim (posicao 2).
    let atualizado = repository::move_item(&db, &service_id, &ids[0], 2).expect("deveria mover");

    let titulos: Vec<&str> = atualizado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(titulos, ["Segunda", "Terceira", "Primeira"]);
}

#[test]
fn mover_para_tras_reordena_os_itens_entre_as_duas_posicoes() {
    let db = banco();
    let (service_id, ids) = montar_culto_de_tres(&db);

    // Move "Terceira" (posicao 2) para o inicio (posicao 0).
    let atualizado = repository::move_item(&db, &service_id, &ids[2], 0).expect("deveria mover");

    let titulos: Vec<&str> = atualizado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(titulos, ["Terceira", "Primeira", "Segunda"]);
}

#[test]
fn mover_para_a_mesma_posicao_nao_muda_nada() {
    let db = banco();
    let (service_id, ids) = montar_culto_de_tres(&db);

    let atualizado =
        repository::move_item(&db, &service_id, &ids[1], 1).expect("deveria aceitar sem mudar");

    let titulos: Vec<&str> = atualizado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(titulos, ["Primeira", "Segunda", "Terceira"]);
}

#[test]
fn mover_para_posicao_fora_da_faixa_e_recusado_e_nao_truncado() {
    let db = banco();
    let (service_id, ids) = montar_culto_de_tres(&db);

    let erro = repository::move_item(&db, &service_id, &ids[0], 99).expect_err("deveria recusar");
    assert_eq!(erro.code, AppErrorCode::InvalidInput);

    // Um clique errado (ou um arrasto que solta fora da lista) nao pode ter
    // mudado nada.
    let recarregado = repository::get(&db, &service_id).expect("get");
    let titulos: Vec<&str> = recarregado.items.iter().map(|i| i.title.as_str()).collect();
    assert_eq!(titulos, ["Primeira", "Segunda", "Terceira"]);
}

#[test]
fn mover_para_posicao_negativa_e_recusado() {
    let db = banco();
    let (service_id, ids) = montar_culto_de_tres(&db);

    let erro = repository::move_item(&db, &service_id, &ids[0], -1).expect_err("deveria recusar");
    assert_eq!(erro.code, AppErrorCode::InvalidInput);
}

#[test]
fn as_posicoes_continuam_sequenciais_apos_varios_movimentos() {
    let db = banco();
    let (service_id, ids) = montar_culto_de_tres(&db);

    repository::move_item(&db, &service_id, &ids[0], 2).expect("mover 1");
    repository::move_item(&db, &service_id, &ids[2], 0).expect("mover 2");

    let recarregado = repository::get(&db, &service_id).expect("get");
    let posicoes: Vec<i64> = recarregado.items.iter().map(|i| i.position).collect();
    assert_eq!(
        posicoes,
        [0, 1, 2],
        "nao pode sobrar buraco ou repeticao de posicao"
    );
}
