# Orçamento de performance

Leveza não é uma intenção; é um número que se mede e que quebra o build quando
estoura. Este documento define os limites e registra as medições reais.

## Máquina de referência

O alvo não é um PC moderno. É o que a igreja tem:

- CPU de 2 núcleos, geração antiga (Celeron / i3 de ~2015)
- 4 GB de RAM, dos quais o app disputa espaço com navegador e player de vídeo
- HD mecânico ou SSD de entrada
- Windows 10 ou uma distribuição Linux enxuta

Se funcionar bem aqui, funciona em qualquer lugar. A recíproca é falsa, e é por
isso que a referência é essa.

## Orçamento

| Métrica                              | Limite    | Por quê                                        |
| ------------------------------------ | --------- | ---------------------------------------------- |
| RAM em repouso — Linux (WebKitGTK)   | < 250 MB  | piso alto da plataforma; ver a nota abaixo     |
| RAM em repouso — Windows (WebView2)  | a medir   | plataforma real da maioria das igrejas         |
| RAM projetando (segunda janela)      | + <100 MB | a segunda tela não pode dobrar o custo         |
| CPU em repouso                       | ~0 %      | nada de timer/polling rodando à toa            |
| Tempo até a janela aparecer          | < 2 s     | ninguém espera o culto pelo software           |
| Busca de música (biblioteca de 5000) | < 50 ms   | tem que parecer instantânea enquanto se digita |
| Troca de slide (comando → tela)      | < 100 ms  | acima disso o operador percebe atraso          |
| JS do bundle (gzip)                  | < 150 kB  | tempo de parse é caro em CPU fraca             |
| Binário instalado                    | < 40 MB   | Electron equivalente passaria de 150 MB        |

## Medições

Ambiente da medição: container Linux x86_64, Node 22, Rust 1.94, build release.
Números de RAM e tempo de partida dependem de máquina real com display; os que
estão marcados como pendentes serão preenchidos quando houver um alvo com GUI.

| Métrica                         | Medido      | Limite | Folga |
| ------------------------------- | ----------- | ------ | ----- |
| Busca em 5000 músicas (release) | **11 ms**   | 50 ms  | 78 %  |
| Busca em 5000 músicas (debug)   | 24 ms       | —      | —     |
| JS do bundle (gzip)             | **76,0 kB** | 150 kB | 49 %  |
| CSS do bundle (gzip)            | **3,6 kB**  | —      | —     |
| Binário release (Linux)         | **4,9 MB**  | 40 MB  | 88 %  |
| RAM em repouso (Linux, sem GPU) | **231 MB**  | 250 MB | 8 %   |
| RAM em repouso (Windows/macOS)  | a medir     | —      | —     |
| Tempo até a janela              | a medir     | 2 s    | —     |

A busca foi medida no pior caso do ranking: um termo presente em todas as 5000
músicas, obrigando o FTS5 a ordenar o conjunto inteiro. O teste
`busca_em_biblioteca_grande_continua_rapida` refaz essa medição a cada execução
da suíte, então o número não envelhece em silêncio.

O binário release tem **4,9 MB** com o frontend e o SQLite embutidos — o SQLite
custou 1,3 MB, que é o preço de não depender de biblioteca do sistema. Um
aplicativo Electron equivalente parte de ~150 MB instalados: trinta vezes mais,
antes de embutir banco nenhum.

Os 76,0 kB de JavaScript continuam sendo quase inteiramente React + React DOM.
A biblioteca de músicas completa — busca, lista, favoritos, detalhe, cadastro e
edição — custou **4,2 kB** sobre a base da Fase 0, porque a busca vive no SQLite
e não em JavaScript. É
a decisão do [ADR 0002](adr/0002-acesso-a-dados-sqlite-sem-orm.md) se pagando na
prática.

Ainda assim, metade do orçamento está gasta em framework antes de o produto
estar pronto. O espaço restante é apertado, e cada dependência nova precisa ser
justificada de verdade.

Estes números são de build release verificado, não de estimativa. São
atualizados a cada fase.

### Sobre a RAM: o orçamento original estava errado

O limite de 150 MB deste documento foi escrito **antes de qualquer medição** —
era uma intenção, não um número. Ao rodar o aplicativo pela primeira vez, a
medição real no Linux foi de **345 MB de PSS**, mais que o dobro.

O detalhamento explica de onde vem:

| Processo               | PSS    |
| ---------------------- | ------ |
| `holy-media` (Rust)    | 99 MB  |
| `WebKitWebProcess`     | 235 MB |
| `WebKitNetworkProcess` | 22 MB  |

O núcleo Rust custa pouco. O peso é do **WebKitGTK**, o motor que o Tauri usa no
Linux — e a medição foi feita sem GPU (renderização por software), que é o pior
caso e também o caso de muito PC de igreja.

Desligar o modo de composição do WebKit derrubou o total para **231 MB**, uma
economia de 114 MB. Isso está aplicado no código (ver abaixo).

Duas honestidades necessárias:

1. **O limite foi revisado para 250 MB no Linux**, porque 150 MB não é
   alcançável nessa plataforma sem trocar de motor de renderização. Mover a
   meta é ruim; fingir que o número antigo era atingível seria pior.
2. **Windows ainda não foi medido**, e é a plataforma da maioria das igrejas
   brasileiras. Lá o Tauri usa WebView2, com perfil de memória diferente e
   compartilhado com o sistema. O número pode ser bem melhor — mas até alguém
   medir numa máquina real, ele não existe.

Para comparação de ordem de grandeza: um Electron equivalente parte de 200–400
MB **antes** do código da aplicação, com o Chromium inteiro no instalador. A
escolha do Tauri continua certa; ela só não é mágica.

## Decisões já tomadas em nome disso

**Modo de composição do WebKit desligado no Linux.** Medido: 345 MB → 231 MB de
PSS. A troca é animação e vídeo mais lentos, o que não pesa enquanto a projeção
é texto estático. Está em `lib.rs`, respeita a variável se o usuário já a tiver
definido, e **a Fase 2 (vídeo na segunda tela) precisa reavaliar** — provavelmente
religando a composição quando houver GPU.

**Tauri, não Electron.** O motivo número um. Ver [README](../README.md).

**Perfil release do Rust ajustado para tamanho:**

```toml
codegen-units = 1   # menos paralelismo na compilação, binário menor
lto = true          # elimina código morto entre crates
opt-level = "s"     # otimiza tamanho, não velocidade máxima
panic = "abort"     # remove toda a maquinaria de unwinding
strip = true        # sem símbolos de debug no binário final
```

**Sem ORM.** Prisma carregaria um query engine nativo de dezenas de MB e um
processo extra. Drizzle rodaria em JavaScript, do lado errado da fronteira. O
acesso é SQL direto em Rust. Ver
[ADR 0002](adr/0002-acesso-a-dados-sqlite-sem-orm.md).

**Sem tailwind.config.js.** Tailwind v4 define o tema no próprio CSS: um passo a
menos no build e nenhum runtime.

**shadcn/ui escrito à mão, não instalado inteiro.** O app precisa de poucos
primitivos. Cada componente entra quando for usado de verdade.

**A API do Tauri é importada sob demanda** (`await import(...)` dentro do
`invokeCommand`), para não entrar no chunk inicial nem ser baixada quando a
interface roda no navegador.

**`overflow: hidden` no `body`.** O Control Room é um layout de painéis fixos;
nenhuma tela do app rola inteira. Isso evita reflow em janela grande.

## Regras para quem for programar aqui

1. **Nada de polling.** Estado muda por evento. Um `setInterval` rodando durante
   duas horas de culto num Celeron não é gratuito.
2. **Nada de trabalho em background sem dono.** Todo processo de fundo precisa
   de um motivo escrito e de um jeito de desligar.
3. **Busca vai no SQLite, não em JavaScript.** Carregar 5000 músicas na memória
   para filtrar com `Array.filter` é o caminho mais curto para estourar o
   orçamento de RAM. FTS5 existe para isso.
4. **Imagem grande é redimensionada na importação**, não a cada render.
5. **Dependência nova precisa de justificativa** no PR, com o custo em kB.
6. **Nenhum estado global que force re-render de tudo.** Uma store por domínio;
   seletores estreitos. A biblioteca de músicas re-renderizando não pode tocar
   na janela de projeção.
7. **A janela de projeção é sagrada.** Ela renderiza o mínimo possível e não
   compartilha estado de UI com o Control Room.
