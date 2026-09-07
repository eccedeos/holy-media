//! Testes do motor de apresentacao.
//!
//! O criterio destes testes nao e' cobertura de linha: e' cobrir o que o
//! operador faz num culto de verdade, inclusive as sequencias que so aparecem
//! sob pressao -- avancar com a tela preta, trocar de musica no escuro, apertar
//! "proximo" no ultimo slide.

use super::model::{Output, Presentation, PresentationSlide};
use super::PresentationEngine;

fn slide(label: &str, content: &str) -> PresentationSlide {
    PresentationSlide {
        label: label.to_owned(),
        content: content.to_owned(),
    }
}

/// Musica de quatro slides, como uma de verdade.
fn musica() -> Presentation {
    Presentation {
        source_id: "musica-1".to_owned(),
        title: "Grande e o Senhor".to_owned(),
        slides: vec![
            slide("Verso 1", "Primeira estrofe"),
            slide("Refrao", "Aleluia"),
            slide("Verso 2", "Segunda estrofe"),
            slide("Refrao", "Aleluia"),
        ],
    }
}

fn conteudo(engine: &PresentationEngine) -> Option<String> {
    match engine.state().output {
        Output::Slide { content } => Some(content),
        _ => None,
    }
}

// --- estado inicial -------------------------------------------------------

#[test]
fn motor_novo_nao_projeta_nada() {
    let engine = PresentationEngine::new();
    let state = engine.state();

    assert_eq!(state.output, Output::Idle);
    assert_eq!(state.total, 0);
    assert!(!state.can_go_next);
    assert!(!state.can_go_previous);
}

#[test]
fn navegar_sem_nada_carregado_nao_quebra() {
    let mut engine = PresentationEngine::new();

    assert!(!engine.next());
    assert!(!engine.previous());
    assert!(!engine.first());
    assert!(!engine.last());
    assert!(!engine.go_to(3));
    assert_eq!(engine.state().output, Output::Idle);
}

// --- carregar -------------------------------------------------------------

#[test]
fn carregar_comeca_no_primeiro_slide() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    let state = engine.state();
    assert_eq!(state.index, 0);
    assert_eq!(state.total, 4);
    assert_eq!(state.source_id.as_deref(), Some("musica-1"));
    assert_eq!(state.title, "Grande e o Senhor");
    assert_eq!(state.label, "Verso 1");
    assert_eq!(
        state.output,
        Output::Slide {
            content: "Primeira estrofe".to_owned()
        }
    );
}

#[test]
fn carregar_outra_musica_volta_ao_primeiro_slide() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.next();
    engine.next();

    engine.load(Presentation {
        source_id: "musica-2".to_owned(),
        title: "Outra".to_owned(),
        slides: vec![slide("", "Unico")],
    });

    assert_eq!(engine.state().index, 0);
    assert_eq!(conteudo(&engine).as_deref(), Some("Unico"));
}

#[test]
fn carregar_musica_sem_slides_nao_projeta() {
    let mut engine = PresentationEngine::new();
    engine.load(Presentation {
        source_id: "vazia".to_owned(),
        title: "Sem slides".to_owned(),
        slides: Vec::new(),
    });

    assert_eq!(engine.state().output, Output::Idle);
    assert_eq!(engine.state().total, 0);
}

#[test]
fn limpar_volta_ao_estado_de_espera() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.next();

    engine.clear();

    assert_eq!(engine.state().output, Output::Idle);
    assert_eq!(engine.state().index, 0);
    assert_eq!(engine.state().source_id, None);
}

// --- navegacao ------------------------------------------------------------

#[test]
fn avancar_percorre_a_musica_na_ordem() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    let mut vistos = vec![conteudo(&engine).expect("primeiro slide")];
    while engine.next() {
        vistos.push(conteudo(&engine).expect("slide"));
    }

    assert_eq!(
        vistos,
        ["Primeira estrofe", "Aleluia", "Segunda estrofe", "Aleluia"]
    );
}

#[test]
fn avancar_no_ultimo_slide_nao_circula() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.last();

    // Voltar sozinho para o primeiro verso no meio do culto seria pior do que
    // nao fazer nada.
    assert!(!engine.next(), "nao deveria mudar de posicao");
    assert_eq!(engine.state().index, 3);
}

#[test]
fn voltar_no_primeiro_slide_nao_circula() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    assert!(!engine.previous());
    assert_eq!(engine.state().index, 0);
}

#[test]
fn primeiro_e_ultimo_vao_direto_as_pontas() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    assert!(engine.last());
    assert_eq!(engine.state().index, 3);

    assert!(engine.first());
    assert_eq!(engine.state().index, 0);
}

#[test]
fn ir_para_uma_posicao_valida_muda_o_slide() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    assert!(engine.go_to(2));
    assert_eq!(conteudo(&engine).as_deref(), Some("Segunda estrofe"));
}

#[test]
fn indice_fora_da_faixa_e_ignorado_e_nao_truncado() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.go_to(1);

    // Um clique errado nao pode jogar a projecao para o fim da musica.
    assert!(!engine.go_to(99));
    assert_eq!(
        engine.state().index,
        1,
        "a posicao deveria continuar onde estava"
    );
}

#[test]
fn ir_para_a_posicao_atual_nao_conta_como_mudanca() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.go_to(2);

    // Quem chama usa o retorno para decidir se avisa a segunda tela; repetir o
    // mesmo slide nao deve gerar trabalho.
    assert!(!engine.go_to(2));
}

#[test]
fn os_limites_de_navegacao_aparecem_no_estado() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    let inicio = engine.state();
    assert!(inicio.can_go_next);
    assert!(!inicio.can_go_previous);

    engine.last();
    let fim = engine.state();
    assert!(!fim.can_go_next);
    assert!(fim.can_go_previous);
}

// --- tela preta -----------------------------------------------------------

#[test]
fn tela_preta_esconde_o_conteudo() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    assert!(engine.toggle_blackout());
    assert_eq!(engine.state().output, Output::Black);
}

#[test]
fn reacender_mostra_o_mesmo_slide() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.go_to(2);

    engine.toggle_blackout();
    assert!(!engine.toggle_blackout());

    assert_eq!(conteudo(&engine).as_deref(), Some("Segunda estrofe"));
}

#[test]
fn da_para_navegar_com_a_tela_preta_e_reacender_no_slide_certo() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.toggle_blackout();

    // Fluxo real: apaga a tela, procura o slide certo, so' entao mostra.
    engine.next();
    engine.next();
    assert_eq!(
        engine.state().output,
        Output::Black,
        "a tela nao pode acender sozinha"
    );

    engine.toggle_blackout();
    assert_eq!(conteudo(&engine).as_deref(), Some("Segunda estrofe"));
}

#[test]
fn trocar_de_musica_no_escuro_mantem_a_tela_preta() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.toggle_blackout();

    engine.load(Presentation {
        source_id: "musica-2".to_owned(),
        title: "Proxima".to_owned(),
        slides: vec![slide("", "Nova letra")],
    });

    // Se carregar reacendesse a tela, a congregacao veria a preparacao.
    assert_eq!(engine.state().output, Output::Black);
    assert!(engine.state().blacked_out);
}

#[test]
fn a_posicao_continua_visivel_ao_operador_com_a_tela_preta() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.go_to(2);
    engine.toggle_blackout();

    let state = engine.state();
    // A projecao esta preta, mas o Control Room continua sabendo onde esta.
    assert_eq!(state.output, Output::Black);
    assert_eq!(state.index, 2);
    assert_eq!(state.label, "Verso 2");
    assert_eq!(state.title, "Grande e o Senhor");
}

#[test]
fn tela_preta_sem_nada_carregado_ainda_e_preta() {
    let mut engine = PresentationEngine::new();
    engine.toggle_blackout();

    // Preto pedido pelo operador nao e' a mesma coisa que tela de espera.
    assert_eq!(engine.state().output, Output::Black);
}

// --- contrato com a interface ---------------------------------------------

#[test]
fn o_estado_serializa_no_formato_que_o_typescript_espera() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());
    engine.next();

    let json = serde_json::to_value(engine.state()).expect("estado deve serializar");

    assert_eq!(json["output"]["kind"], "slide");
    assert_eq!(json["output"]["content"], "Aleluia");
    assert_eq!(json["index"], 1);
    assert_eq!(json["total"], 4);
    assert_eq!(json["blackedOut"], false);
    assert_eq!(json["canGoNext"], true);
    assert_eq!(json["canGoPrevious"], true);
}

#[test]
fn os_estados_de_saida_tem_discriminante_proprio() {
    let mut engine = PresentationEngine::new();

    let idle = serde_json::to_value(engine.state()).expect("serializa");
    assert_eq!(idle["output"]["kind"], "idle");

    engine.toggle_blackout();
    let black = serde_json::to_value(engine.state()).expect("serializa");
    assert_eq!(black["output"]["kind"], "black");
}

#[test]
fn o_rotulo_do_slide_nao_vai_junto_com_o_conteudo_projetado() {
    let mut engine = PresentationEngine::new();
    engine.load(musica());

    // "Refrao" orienta o operador; projetar isso na tela seria um erro visivel
    // para a congregacao inteira.
    engine.next();
    let state = engine.state();
    assert_eq!(state.label, "Refrao");
    assert_eq!(
        state.output,
        Output::Slide {
            content: "Aleluia".to_owned()
        }
    );
}
