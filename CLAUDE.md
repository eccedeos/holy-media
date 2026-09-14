# Instruções para o Claude neste repositório

## Gerar instalador/executável para teste

**Sempre use o workflow do GitHub Actions, nunca tente compilar localmente
neste ambiente.** Este ambiente de desenvolvimento é Linux; o instalador
Windows (`.msi`/`.exe`) precisa do toolchain Windows de verdade (MSVC +
WiX/NSIS), que só existe de fato numa máquina Windows ou no runner
`windows-latest` do GitHub Actions — tentar cross-compilar daqui produz um
binário nunca testado, o oposto do "verificado, não presumido" que este
projeto exige (ver `docs/implementation-plan.md`).

O workflow já existe: `.github/workflows/build-desktop.yml`. Para gerar um
build de teste:

```
mcp__github__actions_run_trigger
  method: run_workflow
  owner: eccedeos
  repo: holy-media
  workflow_id: build-desktop.yml
  ref: <branch atual>
  inputs: { "instalador": "true" }
```

- `instalador: "true"` é o que importa — sem isso o workflow só publica o
  executável solto (`.exe`/binário), sem o `.msi`/`.deb`/`.AppImage`. Para
  só testar rapidamente que o app abre, `instalador: "false"` (ou omitir)
  basta e é mais rápido.
- Builda Windows e Linux em paralelo. O job do Windows compila o núcleo
  Rust do zero (sem cache quente na primeira vez do dia) e costuma levar
  10-15 minutos.
- Artefatos publicados: `holy-media-windows` / `holy-media-linux`
  (executável), e (com `instalador: true`) `holy-media-windows-instalador`
  / `holy-media-linux-instalador`.
- Acompanhe com `mcp__github__actions_list` (`list_workflow_runs`,
  filtrando por `branch`) até `status: completed`, depois
  `mcp__github__actions_list` (`list_workflow_run_artifacts`) para achar o
  artefato certo e `mcp__github__actions_get`
  (`download_workflow_run_artifact`) ou o link da própria run
  (`https://github.com/eccedeos/holy-media/actions/runs/<id>`) para o
  usuário baixar.

Isto é o que o usuário já usou desde a primeira vez que testou o
aplicativo (run manual, ver histórico do workflow) — é o caminho padrão
daqui para frente, não uma alternativa entre outras.

Mais contexto (pré-requisitos para quem quiser compilar localmente mesmo
assim, e onde ficam os pacotes Linux já gerados neste ambiente) em
[`docs/build-instaladores.md`](docs/build-instaladores.md).
