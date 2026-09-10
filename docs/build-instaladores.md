# Gerando os instaladores

O Tauri empacota para o sistema operacional onde o build roda — não há
build cruzado confiável de Linux para Windows/macOS sem um toolchain extra
que este projeto não assume. Por isso:

- Os pacotes **Linux** (`.deb`, `.rpm`, `.AppImage`) já saem prontos deste
  ambiente de desenvolvimento (que roda Ubuntu) — ver a seção abaixo.
- O instalador **Windows** (`.msi`/`.exe`) precisa ser gerado numa máquina
  Windows.
- O instalador **macOS** (`.dmg`) precisa ser gerado num Mac.

## Linux (já gerado)

```
apps/desktop/src-tauri/target/release/bundle/
├── deb/Holy Media_0.0.1_amd64.deb        (~2,5 MB)
├── rpm/Holy Media-0.0.1-1.x86_64.rpm     (~2,5 MB)
└── appimage/Holy Media_0.0.1_amd64.AppImage  (~78 MB)
```

- **`.deb`** — para Debian/Ubuntu e derivados: `sudo dpkg -i "Holy Media_0.0.1_amd64.deb"`.
- **`.rpm`** — para Fedora/openSUSE e derivados: `sudo rpm -i "Holy Media-0.0.1-1.x86_64.rpm"`.
- **`.AppImage`** — roda em qualquer distribuição sem instalar nada e sem
  privilégio de administrador: `chmod +x "Holy Media_0.0.1_amd64.AppImage"`,
  depois execute o arquivo. É maior porque leva o próprio runtime do
  AppImage embutido — o binário do Holy Media em si continua pequeno (ver
  [`performance.md`](performance.md)).

## Windows

Requisitos (uma vez só, na máquina que vai gerar o instalador):

1. **Node.js** (18+) — já traz o `corepack`, que resolve o `pnpm` sem
   instalação manual. Se aparecer `pnpm: O termo 'pnpm' não é reconhecido`
   no PowerShell, rode `corepack enable` e abra um novo terminal.
2. **Rust** — instale via [rustup.rs](https://rustup.rs); o target padrão
   (`x86_64-pc-windows-msvc`) já é o certo.
3. **Visual Studio Build Tools** com o componente "Desktop development with
   C++" — o Rust MSVC precisa do linker dele. O instalador do Rust já avisa
   se estiver faltando.
4. **WebView2** — já vem instalado no Windows 10/11 atualizados; nada a
   fazer na maioria dos casos.

Com isso pronto:

```powershell
git clone https://github.com/eccedeos/holy-media.git
cd holy-media
git checkout claude/church-projection-master-prompt-cc76fa
pnpm install
pnpm --filter @holy-media/desktop exec tauri build
```

O instalador sai em
`apps/desktop/src-tauri/target/release/bundle/msi/` (e/ou `nsis/`,
dependendo do que o Tauri escolher gerar).

## macOS

Mesma ideia, com as ferramentas do macOS:

```bash
brew install node rustup-init
rustup-init
git clone https://github.com/eccedeos/holy-media.git
cd holy-media
git checkout claude/church-projection-master-prompt-cc76fa
pnpm install
pnpm --filter @holy-media/desktop exec tauri build
```

O `.dmg` sai em `apps/desktop/src-tauri/target/release/bundle/dmg/`.

## Depois de instalar

Nenhuma tradução da Bíblia vem com o instalador, em nenhuma plataforma —
ver o porquê em [`bible.md`](bible.md). É preciso importar um arquivo de
tradução antes de usar o módulo da Bíblia; o formato está documentado no
mesmo arquivo.

Para o roteiro de verificação depois de instalar, ver
[`roteiro-teste-real.md`](roteiro-teste-real.md).
