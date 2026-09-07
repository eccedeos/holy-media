//! Comandos expostos a interface via IPC.
//!
//! Contrato: cada struct devolvida aqui tem espelho em `@holy-media/types`, e
//! a serializacao usa `camelCase` para que o lado TypeScript nao precise de
//! conversao.

pub mod app;
pub mod songs;

pub use app::AppInfo;
