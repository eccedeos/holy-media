# Arquitetura

## Princípio que organiza tudo

O software roda em cima de um PC fraco, numa sala de mídia, durante um culto que
não pode parar. Isso ordena as prioridades:

1. **Não travar.** Um erro em qualquer tela nunca derruba a projeção.
2. **Ser leve.** Cada dependência e cada processo em background precisam se pagar.
3. **Ser rápido no que é repetitivo.** Buscar música e avançar slide acontecem
   centenas de vezes por culto.
4. **Funcionar sem internet.** Rede é opcional, nunca requisito.

Tudo abaixo é consequência disso.

## Visão em camadas

```
┌──────────────────────────────────────────────────────────┐
│  Interface do operador (React + TypeScript)              │
│  Control Room: biblioteca · preview · ordem do culto     │
└────────────────────────┬─────────────────────────────────┘
                         │ IPC tipado (Tauri commands/events)
┌────────────────────────┴─────────────────────────────────┐
│  Núcleo Rust                                             │
│  janelas · SQLite · Presentation Engine · mídia · logs   │
└────────────────────────┬─────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────┴────────┐              ┌─────────┴──────────┐
│ SQLite local   │              │ Segunda tela       │
│ (arquivo único)│              │ (janela dedicada)  │
└────────────────┘              └────────────────────┘
```

Na Fase 3 entra um servidor local opcional (WebSocket) hospedado **dentro do
mesmo processo Rust**, para que o celular vire controle remoto sem adicionar um
segundo runtime na máquina da igreja.

## Fronteiras dos módulos

O sistema é dividido por domínio, não por camada técnica. Cada domínio tem seu
módulo Rust e sua store no frontend:

| Domínio        | Responsabilidade                                        |
| -------------- | ------------------------------------------------------- |
| `songs`        | biblioteca de músicas, slides, busca, importação        |
| `bible`        | traduções, livros, capítulos, versículos, busca         |
| `presentation` | Presentation Engine: sequência de slides e slide atual  |
| `display`      | janela da segunda tela, monitor, fullscreen, tela preta |
| `media`        | imagens, backgrounds, futuros vídeos                    |
| `service`      | ordem do culto (playlist)                               |
| `remote`       | servidor local, pareamento por PIN, protocolo WebSocket |

A regra de acoplamento: **domínios não se importam entre si**. O Presentation
Engine não sabe o que é uma música — ele recebe uma sequência de slides já
renderizada. Quem traduz "música" ou "versículo" em slides é uma camada acima.
É isso que permite adicionar `VIDEO` ou `POWERPOINT` depois sem tocar no motor.

## O Presentation Engine

O coração do sistema, e o pedaço que mais merece ser puro:

- **Entrada:** uma sequência de slides já resolvidos.
- **Estado:** índice atual, modo de saída (ao vivo / preto / tela de espera).
- **Operações:** próximo, anterior, primeiro, último, ir para índice, preto.
- **Saída:** um evento descrevendo o que a segunda tela deve exibir.

Ele não toca no DOM, não fala com o banco e não conhece o Tauri. Isso o torna
testável por completo com testes unitários, que é exatamente o que se quer do
componente que não pode falhar ao vivo.

## A segunda tela

Uma **segunda janela do mesmo processo**, não um segundo processo e não um
`<iframe>`. Ela recebe eventos do núcleo e renderiza apenas conteúdo — sem
menus, sem controles, sem cursor. O raciocínio completo (e as alternativas
descartadas) está no
[ADR 0004](adr/0004-segunda-tela-como-janela-tauri.md).

## Dados

SQLite em arquivo único, acessado **do lado Rust**, sem ORM. Busca de música e
de versículo usam FTS5, que é parte do próprio SQLite — sem índice externo, sem
processo de indexação em background. O porquê está no
[ADR 0002](adr/0002-acesso-a-dados-sqlite-sem-orm.md); o esquema, os pragmas e o
funcionamento da busca estão em [database.md](database.md).

Backup e restauração são, por consequência, copiar um arquivo.

## Tratamento de erros

Três regras:

1. Todo erro que atravessa a fronteira Rust → interface vira um `AppError` com
   `code` (para a lógica), `message` (português, para o operador) e `detail`
   (técnico, só para o log).
2. A interface é envolvida por um `ErrorBoundary`. Um erro de render mostra uma
   tela de recuperação; **a projeção em andamento não é interrompida**, porque
   ela vive em outra janela.
3. Stack trace nunca aparece na tela. Vai para o log.

## Logs

Níveis DEBUG / INFO / WARN / ERROR, com escopo por módulo (`ipc`, `display`,
`remote`, `db`). Chaves sensíveis — senha, token, PIN, chave PIX — são redigidas
automaticamente antes de qualquer registro, em qualquer profundidade do objeto.
Isso é testado, não confiado à disciplina de quem escreve o `log.info`.

## Contratos compartilhados

`packages/types` guarda os tipos que atravessam fronteiras (Rust ↔ interface ↔
futuro controle remoto). É **type-only**: some por completo no build, então não
custa nada em runtime. Cada struct Rust serializada para a interface tem um
espelho lá, e a serialização usa `camelCase` para não exigir conversão no meio
do caminho.

## Preparado para, sem pagar agora

Estas decisões existem para não bloquear o futuro, e nenhuma delas custa
complexidade hoje:

- **Multi-tenant (Fase 6):** as tabelas de conteúdo nascem com chave primária
  opaca e sem depender de "existe só uma igreja". Adicionar `tenant_id` depois é
  uma migration, não uma reescrita.
- **Sincronização (Fase 5):** toda entidade carrega `created_at` / `updated_at`
  desde a primeira migration.
- **Controle remoto (Fase 3):** o Presentation Engine já é a única fonte de
  verdade do estado da apresentação. O celular vira mais um cliente dele.
- **App nativo (pós-Fase 3):** o controle remoto nasce como PWA no navegador do
  celular; virar app nativo depois é trocar a casca, não o protocolo. Ver
  [ADR 0003](adr/0003-controle-remoto-como-pwa.md).

O que **não** fazemos agora: criar os módulos vazios dessas fases.
