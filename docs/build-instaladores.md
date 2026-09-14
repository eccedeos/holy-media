# Gerando os instaladores

O Tauri empacota para o sistema operacional onde o build roda — não há
build cruzado confiável de Linux para Windows/macOS sem um toolchain extra
que este projeto não assume.

## Caminho padrão: GitHub Actions (recomendado)

**Esta é a forma usada desde o primeiro teste do aplicativo, e a que deve
seguir sendo usada.** O workflow `.github/workflows/build-desktop.yml`
builda Windows e Linux sob demanda, num runner de verdade de cada sistema
— sem exigir Rust, Node nem as Build Tools do Visual Studio na sua máquina.

1. Na aba **Actions** do repositório no GitHub, abra "Build do aplicativo".
2. **Run workflow**, escolha a branch, marque **"Gerar também o
   instalador"** (senão só sai o executável solto, sem `.msi`/`.deb`).
3. Espere o run terminar (o job do Windows compila o núcleo Rust do zero,
   costuma levar 10-15 minutos) e baixe o artefato
   `holy-media-windows-instalador` (ou `holy-media-linux-instalador`) na
   página do run.

Peça para o Claude disparar isso por você a qualquer momento — ele tem
acesso à API do GitHub Actions neste repositório (ver `CLAUDE.md`).

## Build local — só se o workflow não for uma opção

As seções abaixo continuam valendo para quem quiser (ou precisar) compilar
na própria máquina, mas não é o caminho padrão do projeto.

### Linux (já gerado neste ambiente de desenvolvimento)

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

### Windows

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

### macOS

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
