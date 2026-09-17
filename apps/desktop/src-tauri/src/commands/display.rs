//! Comandos da janela de projecao.

use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::display::{self, DisplayState};
use crate::error::AppResult;

/// Monitor escolhido e se a projecao esta aberta, nesta sessao.
///
/// Nao e' persistido ainda: a tabela de configuracoes entra na Fase 4. Enquanto
/// isso o operador escolhe uma vez por abertura do aplicativo, e a escolha
/// sobrevive a fechar e reabrir a projecao.
///
/// `is_open` e' guardado aqui, explicito, em vez de perguntado a` janela
/// nativa (`window.is_visible()`): mostrar/esconder uma janela e' assincrono
/// no GTK/WebKit, e perguntar a visibilidade logo depois de chamar `show()`
/// (na mesma chamada sincrona) podia devolver o valor antigo -- o indicador
/// "no ar" ficava um passo atrasado. Quem chama `open`/`close` sabe o
/// resultado sem precisar perguntar.
#[derive(Default)]
pub struct SelectedMonitor {
    index: Mutex<Option<usize>>,
    is_open: Mutex<bool>,
}

impl SelectedMonitor {
    fn get(&self) -> Option<usize> {
        *self
            .index
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn set(&self, index: Option<usize>) {
        *self
            .index
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = index;
    }

    fn is_open(&self) -> bool {
        *self
            .is_open
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn set_open(&self, open: bool) {
        *self
            .is_open
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = open;
    }
}

#[tauri::command]
pub fn display_state(
    app: AppHandle,
    selected: State<'_, SelectedMonitor>,
) -> AppResult<DisplayState> {
    display::state(&app, selected.get(), selected.is_open())
}

/// Abre a projecao no monitor escolhido (ou move a janela ja aberta).
#[tauri::command]
pub fn display_open(
    app: AppHandle,
    selected: State<'_, SelectedMonitor>,
    monitor_index: usize,
) -> AppResult<DisplayState> {
    display::open(&app, monitor_index)?;
    selected.set(Some(monitor_index));
    selected.set_open(true);
    display::state(&app, selected.get(), selected.is_open())
}

#[tauri::command]
pub fn display_close(
    app: AppHandle,
    selected: State<'_, SelectedMonitor>,
) -> AppResult<DisplayState> {
    display::close(&app)?;
    selected.set_open(false);
    // A escolha do monitor e' preservada: fechar a projecao entre um ensaio e
    // o culto nao deve obrigar a escolher tudo de novo.
    display::state(&app, selected.get(), selected.is_open())
}
