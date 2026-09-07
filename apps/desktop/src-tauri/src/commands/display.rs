//! Comandos da janela de projecao.

use std::sync::Mutex;

use tauri::{AppHandle, State};

use crate::display::{self, DisplayState};
use crate::error::AppResult;

/// Monitor escolhido nesta sessao.
///
/// Nao e' persistido ainda: a tabela de configuracoes entra na Fase 4. Enquanto
/// isso o operador escolhe uma vez por abertura do aplicativo, e a escolha
/// sobrevive a fechar e reabrir a projecao.
#[derive(Default)]
pub struct SelectedMonitor(pub Mutex<Option<usize>>);

impl SelectedMonitor {
    fn get(&self) -> Option<usize> {
        *self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn set(&self, index: Option<usize>) {
        *self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = index;
    }
}

#[tauri::command]
pub fn display_state(
    app: AppHandle,
    selected: State<'_, SelectedMonitor>,
) -> AppResult<DisplayState> {
    display::state(&app, selected.get())
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
    display::state(&app, selected.get())
}

#[tauri::command]
pub fn display_close(
    app: AppHandle,
    selected: State<'_, SelectedMonitor>,
) -> AppResult<DisplayState> {
    display::close(&app)?;
    // A escolha do monitor e' preservada: fechar a projecao entre um ensaio e
    // o culto nao deve obrigar a escolher tudo de novo.
    display::state(&app, selected.get())
}
