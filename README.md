# Holy Media

Software de projeção para igrejas: letras, Bíblia, imagens, textos e QR Codes na
segunda tela, com controle rápido pelo operador.

**Requisito central do produto:** leveza. O software precisa rodar bem no PC
fraco que a igreja já tem, funcionar **sem internet** e nunca travar no meio de
um culto.

> **Estado atual: Fase 1 em andamento.** Já dá para cadastrar músicas, buscar
> por título, artista, letra ou tag (11 ms numa biblioteca de 5000, ignorando
> acentos) e **projetar de verdade**: escolher o monitor, abrir a tela cheia no
> projetor, avançar e voltar slides, tela preta. Faltam Bíblia, ordem do culto e
> backgrounds. Veja [docs/roadmap.md](docs/roadmap.md).

## Por que Tauri e não Electron

Electron embute um Chromium inteiro: ~150 MB de instalador e 200–400 MB de RAM
só para abrir uma janela vazia. O Tauri usa o WebView que já vem no sistema
operacional, então o binário fica na casa de dezenas de MB e a memória base é
uma fração disso. Para um app que vai rodar num PC de sala de mídia com 4 GB de
RAM ao lado de um navegador e de um player de vídeo, essa diferença é o produto.

Os números medidos deste repositório estão em
[docs/performance.md](docs/performance.md).

## Requisitos

| Ferramenta | Versão           |
| ---------- | ---------------- |
| Node.js    | >= 22            |
| pnpm       | >= 10            |
| Rust       | >= 1.77 (stable) |

No Linux, o Tauri também precisa das bibliotecas de sistema do WebKitGTK:

```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf
```

**No Windows**, para compilar são necessários:

1. [Node.js 22+](https://nodejs.org) — depois, `corepack enable` no PowerShell
   habilita o pnpm sem instalação separada
2. [Rust](https://rustup.rs) (`rustup-init.exe`)
3. [Build Tools do Visual Studio](https://visualstudio.microsoft.com/pt-br/visual-studio-build-tools/),
   com a carga de trabalho **"Desenvolvimento para desktop com C++"**

O WebView2 já vem no Windows 10/11 atualizado.

**Não quer instalar nada?** A aba **Actions** do repositório tem o workflow
**"Build do aplicativo"**: dispare pelo botão _Run workflow_ e baixe o
executável pronto no fim. Ver [docs/performance.md](docs/performance.md#como-medir).

**No macOS**: Xcode Command Line Tools.

## Começando

```bash
pnpm install          # instala as dependências do workspace
pnpm tauri:dev        # sobe o app desktop (Vite + janela nativa)
```

Para trabalhar só na interface, sem compilar o Rust:

```bash
pnpm dev              # http://localhost:1420 no navegador
```

No navegador os recursos nativos ficam indisponíveis de propósito — a interface
detecta isso e mostra um aviso em vez de quebrar.

## Comandos

| Comando            | O que faz                                  |
| ------------------ | ------------------------------------------ |
| `pnpm dev`         | Interface no navegador (Vite)              |
| `pnpm tauri:dev`   | Aplicativo desktop completo                |
| `pnpm build`       | Typecheck + build de produção da interface |
| `pnpm typecheck`   | TypeScript em todo o workspace             |
| `pnpm test`        | Testes do frontend (Vitest)                |
| `pnpm lint`        | ESLint                                     |
| `pnpm format`      | Prettier (escrita)                         |
| `pnpm rust:test`   | Testes do núcleo Rust                      |
| `pnpm rust:clippy` | Lint do Rust                               |
| `pnpm size`        | Verifica o orçamento de bundle             |
| `pnpm verify`      | Tudo acima, na ordem em que o CI roda      |

## Estrutura

```
apps/
  desktop/            # aplicativo Tauri (React + TypeScript)
    src/              # interface do operador
    src-tauri/        # núcleo Rust: janelas, IPC, futuro acesso ao SQLite
packages/
  types/              # contratos compartilhados (type-only, zero runtime)
  config/             # tsconfig base do workspace
docs/                 # arquitetura, roadmap, decisões (ADR)
```

A estrutura cresce por necessidade, não por antecipação: `local-server`,
`mobile` e os pacotes de domínio entram nas fases que os usam. O motivo está em
[docs/adr/0001-escopo-do-monorepo.md](docs/adr/0001-escopo-do-monorepo.md).

## Documentação

- [Arquitetura](docs/architecture.md)
- [Banco de dados e busca](docs/database.md)
- [Presentation Engine](docs/presentation-engine.md)
- [Roadmap por fases](docs/roadmap.md)
- [Plano de implementação](docs/implementation-plan.md)
- [Orçamento de performance](docs/performance.md)
- [Guia de desenvolvimento](docs/development.md)
- [Decisões arquiteturais (ADR)](docs/adr/)

## Licença

MIT.

### Sobre conteúdo de terceiros

O projeto **não** distribui letras de música nem traduções bíblicas protegidas
por direitos autorais, e não faz scraping de sites de letras. O que existe é a
capacidade de **importar** conteúdo que a igreja já possua ou que esteja em
domínio público / devidamente licenciado. A responsabilidade pelo conteúdo
importado é de quem o importa.
