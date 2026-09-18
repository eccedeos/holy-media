//! A janela de projecao: a tela que a congregacao ve.
//!
//! Conforme o [ADR 0004], a projecao e' uma **segunda janela do mesmo
//! processo** -- nao um segundo processo (dobraria a memoria) e nao um `<div>`
//! em tela cheia (nao funciona em dois monitores, e um erro no Control Room
//! levaria a projecao junto).
//!
//! A janela renderiza apenas o `Output` do motor. Ela nao consulta banco, nao
//! conhece musica e nao decide nada.

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::{AppError, AppErrorCode, AppResult};

/// Rotulo da janela de projecao. Usado para encontra-la e para o frontend
/// saber que papel esta desempenhando.
pub const PROJECTION_LABEL: &str = "projection";

/// Rotulo da janela do operador, como declarado no `tauri.conf.json`.
const CONTROL_ROOM_LABEL: &str = "control-room";

/// Marca injetada antes de qualquer script da pagina, para a interface saber
/// que esta rodando na janela de projecao.
///
/// E' sincrono de proposito: ler o rotulo pela API do Tauri seria assincrono, e
/// a projecao piscaria o Control Room por um quadro antes de se corrigir --
/// na frente da igreja inteira.
const ROLE_SCRIPT: &str = "window.__HOLY_MEDIA_ROLE__ = 'projection';";

/// Um monitor disponivel para projetar.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    /// Posicao na lista. E' o que a interface manda de volta ao escolher.
    pub index: usize,
    /// Nome do sistema operacional, quando ha um.
    pub name: String,
    pub width: u32,
    pub height: u32,
    /// `true` quando o Control Room esta neste monitor. Projetar aqui cobriria
    /// a tela do proprio operador, entao a interface avisa.
    pub is_current: bool,
}

/// Estado da projecao, para a interface refletir os botoes.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplayState {
    pub monitors: Vec<MonitorInfo>,
    /// `true` quando a janela de projecao esta aberta.
    pub is_open: bool,
    /// Indice do monitor em uso, quando aberta.
    pub monitor_index: Option<usize>,
}

fn display_error(detail: impl std::fmt::Display) -> AppError {
    AppError::new(
        AppErrorCode::DisplayFailed,
        "Nao foi possivel controlar a tela de projecao.",
    )
    .with_detail(detail.to_string())
}

/// Lista os monitores conectados.
pub fn list_monitors(app: &AppHandle) -> AppResult<Vec<MonitorInfo>> {
    let monitors = app.available_monitors().map_err(display_error)?;

    // O monitor onde esta o Control Room. Se nao der para descobrir, seguimos
    // sem a marcacao em vez de falhar: ela e' um aviso, nao um requisito.
    let current = app
        .get_webview_window(CONTROL_ROOM_LABEL)
        .and_then(|window| window.current_monitor().ok().flatten())
        .and_then(|monitor| monitor.name().cloned());

    Ok(monitors
        .into_iter()
        .enumerate()
        .map(|(index, monitor)| {
            let name = monitor
                .name()
                .cloned()
                .unwrap_or_else(|| format!("Monitor {}", index + 1));
            MonitorInfo {
                index,
                is_current: current.as_ref() == Some(&name),
                width: monitor.size().width,
                height: monitor.size().height,
                name,
            }
        })
        .collect())
}

/// Constroi a janela de projecao, escondida, com o titulo/decoracao padrao.
fn build_projection_window<M: tauri::Manager<tauri::Wry>>(
    app: &M,
) -> tauri::WebviewWindowBuilder<'_, tauri::Wry, M> {
    WebviewWindowBuilder::new(app, PROJECTION_LABEL, WebviewUrl::App("index.html".into()))
        .title("Holy Media - Projecao")
        // Sem barra de titulo nem bordas: a congregacao ve conteudo, nao
        // uma janela de computador.
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .initialization_script(ROLE_SCRIPT)
}

/// Cria a janela de projecao no Windows, compartilhando o ambiente do
/// WebView2 que o Control Room ja tem em vez de deixar criar um novo do
/// zero -- ver o comentario de `ensure_created` para o porque disso importar.
///
/// O ambiente (`ICoreWebView2Environment`) nao e' `Send` -- nao da para
/// tira-lo do closure do `with_webview` por um canal, como se fosse um valor
/// qualquer. Por isso a janela inteira e' construida AQUI DENTRO, na mesma
/// chamada que ja tem o ambiente do Control Room em maos; so' o resultado
/// (sucesso ou erro, que sao `Send`) sai pelo canal.
#[cfg(windows)]
fn create_projection_webview(app: &AppHandle) -> AppResult<()> {
    let control_room = app.get_webview_window(CONTROL_ROOM_LABEL).ok_or_else(|| {
        AppError::new(
            AppErrorCode::DisplayFailed,
            "Nao foi possivel controlar a tela de projecao.",
        )
        .with_detail("janela do operador nao encontrada")
    })?;

    let app = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<AppResult<()>>();
    control_room
        .with_webview(move |webview| {
            let result = build_projection_window(&app)
                .with_environment(webview.environment())
                .build()
                .map(|_| ())
                .map_err(display_error);
            let _ = tx.send(result);
        })
        .map_err(display_error)?;

    rx.recv().map_err(display_error)?
}

/// Cria a janela de projecao fora do Windows -- aqui o `WebContext` do Tauri
/// ja reaproveita o motor entre janelas por conta propria, sem precisar
/// compartilhar nada na mao.
#[cfg(not(windows))]
fn create_projection_webview(app: &AppHandle) -> AppResult<()> {
    build_projection_window(app)
        .build()
        .map(|_| ())
        .map_err(display_error)
}

/// Garante que a janela de projecao existe, escondida, sem se preocupar com
/// monitor -- quem decide onde e quando mostrar e' `open`.
///
/// Chamada uma vez, no `setup()` do app: e' aqui que o custo pesado de criar
/// o WebView2 da segunda janela acontece, antes do operador comecar a usar o
/// programa. Sem isto, esse custo cairia exatamente no meio do culto, na
/// primeira vez que o operador clicasse em "abrir projecao" -- e no Windows,
/// sem um ambiente compartilhado, criar um WebView2 do zero e' pesado em
/// disco e sincrono na mesma thread que desenha as duas janelas, travando o
/// app inteiro (nao so' a projecao) pelo tempo que isso levar. Reordenar as
/// chamadas nativas de janela (as duas tentativas anteriores) nunca ia
/// resolver isto -- o gasto esta em criar a janela, nao na ordem das
/// chamadas depois de criada.
pub fn ensure_created(app: &AppHandle) -> AppResult<()> {
    if app.get_webview_window(PROJECTION_LABEL).is_some() {
        return Ok(());
    }

    create_projection_webview(app)
}

/// Abre a projecao no monitor escolhido, ou move a janela ja aberta para la.
pub fn open(app: &AppHandle, monitor_index: usize) -> AppResult<()> {
    let monitors = app.available_monitors().map_err(display_error)?;
    let monitor = monitors.get(monitor_index).ok_or_else(|| {
        // Acontece de verdade: o cabo do projetor cai no meio do culto e o
        // monitor que estava salvo deixa de existir.
        AppError::new(
            AppErrorCode::DisplayFailed,
            "O monitor escolhido nao esta mais conectado.",
        )
    })?;

    let position = *monitor.position();
    let size = *monitor.size();

    // Rede de seguranca: `ensure_created` ja devia ter rodado no setup do
    // app. So' entraria aqui se isso tivesse falhado por algum motivo.
    ensure_created(app)?;
    let window = app
        .get_webview_window(PROJECTION_LABEL)
        .ok_or_else(|| display_error("janela de projecao nao encontrada apos criar"))?;

    // Sair da tela cheia antes de reposicionar -- em varios sistemas o
    // fullscreen usa o monitor onde a janela esta naquele momento.
    window.set_fullscreen(false).map_err(display_error)?;
    window.set_position(position).map_err(display_error)?;
    window.set_size(size).map_err(display_error)?;
    window.set_fullscreen(true).map_err(display_error)?;
    window.show().map_err(display_error)?;

    Ok(())
}

/// Fecha a projecao.
///
/// Esconde a janela em vez de destrui-la: ela continua existindo (com o
/// WebView2 ja pronto) para a proxima vez que o operador abrir a projecao
/// nao pagar de novo o custo de criar tudo do zero -- ver `ensure_created`.
pub fn close(app: &AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window(PROJECTION_LABEL) {
        window.hide().map_err(display_error)?;
    }
    Ok(())
}

/// Retrato do estado da projecao.
///
/// `is_open` vem de quem chamou -- `commands::display::SelectedMonitor` --
/// em vez de ser calculado aqui a partir da janela nativa. Depois que `close`
/// passou a esconder em vez de destruir, a janela sempre existe depois do
/// primeiro `open`, entao "a janela existe" nao serve mais de sinal; e
/// perguntar `window.is_visible()` bem depois de chamar `show()`/`hide()`
/// tem uma corrida real (o GTK/WebKit mapeia a janela de forma assincrona).
pub fn state(
    app: &AppHandle,
    monitor_index: Option<usize>,
    is_open: bool,
) -> AppResult<DisplayState> {
    Ok(DisplayState {
        monitors: list_monitors(app)?,
        is_open,
        monitor_index: if is_open { monitor_index } else { None },
    })
}
