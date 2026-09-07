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

    let window = match app.get_webview_window(PROJECTION_LABEL) {
        Some(existing) => existing,
        None => {
            WebviewWindowBuilder::new(app, PROJECTION_LABEL, WebviewUrl::App("index.html".into()))
                .title("Holy Media - Projecao")
                // Sem barra de titulo nem bordas: a congregacao ve conteudo, nao
                // uma janela de computador.
                .decorations(false)
                .resizable(false)
                .skip_taskbar(true)
                .initialization_script(ROLE_SCRIPT)
                .build()
                .map_err(display_error)?
        }
    };

    // Posicionar antes de ir para tela cheia: em varios sistemas o fullscreen
    // usa o monitor onde a janela esta naquele momento.
    window.set_fullscreen(false).map_err(display_error)?;
    window.set_position(position).map_err(display_error)?;
    window.set_size(size).map_err(display_error)?;
    window.set_fullscreen(true).map_err(display_error)?;
    window.show().map_err(display_error)?;

    Ok(())
}

/// Fecha a projecao.
pub fn close(app: &AppHandle) -> AppResult<()> {
    if let Some(window) = app.get_webview_window(PROJECTION_LABEL) {
        window.close().map_err(display_error)?;
    }
    Ok(())
}

/// Retrato do estado da projecao.
pub fn state(app: &AppHandle, monitor_index: Option<usize>) -> AppResult<DisplayState> {
    let is_open = app.get_webview_window(PROJECTION_LABEL).is_some();
    Ok(DisplayState {
        monitors: list_monitors(app)?,
        is_open,
        monitor_index: if is_open { monitor_index } else { None },
    })
}
