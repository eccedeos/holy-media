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

| Métrica                              | Limite   | Por quê                                        |
| ------------------------------------ | -------- | ---------------------------------------------- |
| RAM em repouso (app aberto, parado)  | < 150 MB | precisa caber junto do resto que a igreja usa  |
| RAM projetando (2 janelas, ao vivo)  | < 250 MB | segunda tela não pode dobrar o custo           |
| CPU em repouso                       | ~0 %     | nada de timer/polling rodando à toa            |
| Tempo até a janela aparecer          | < 2 s    | ninguém espera o culto pelo software           |
| Busca de música (biblioteca de 5000) | < 50 ms  | tem que parecer instantânea enquanto se digita |
| Troca de slide (comando → tela)      | < 100 ms | acima disso o operador percebe atraso          |
| JS do bundle (gzip)                  | < 150 kB | tempo de parse é caro em CPU fraca             |
| Binário instalado                    | < 40 MB  | Electron equivalente passaria de 150 MB        |

## Medições

Ambiente da medição: container Linux x86_64, Node 22, Rust 1.94, build release.
Números de RAM e tempo de partida dependem de máquina real com display; os que
estão marcados como pendentes serão preenchidos quando houver um alvo com GUI.

| Métrica                 | Medido      | Limite | Folga |
| ----------------------- | ----------- | ------ | ----- |
| JS do bundle (gzip)     | **71,8 kB** | 150 kB | 51 %  |
| CSS do bundle (gzip)    | **3,0 kB**  | —      | —     |
| Binário release (Linux) | **3,6 MB**  | 40 MB  | 91 %  |
| RAM em repouso          | pendente    | 150 MB | —     |
| Tempo até a janela      | pendente    | 2 s    | —     |

O binário release tem **3,6 MB** com o frontend já embutido. Um aplicativo
Electron equivalente parte de ~150 MB instalados — a diferença é de mais de
quarenta vezes, e é exatamente o que faz o app caber no PC de referência.

Os 71,8 kB de JavaScript são quase inteiramente React + React DOM. Ou seja: o
código do produto ainda não existe e metade do orçamento já está gasta em
framework. Isso é aceitável — React paga por si em produtividade e em qualidade
de UI — mas significa que o orçamento restante é apertado e que cada
dependência nova precisa ser justificada de verdade.

Estes números são de build release verificado, não de estimativa. São
atualizados a cada fase.

## Decisões já tomadas em nome disso

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
