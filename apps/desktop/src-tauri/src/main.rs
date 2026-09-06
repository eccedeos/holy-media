// Sem console extra no Windows em release: o operador abre o app, nao um terminal.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    holy_media_lib::run();
}
