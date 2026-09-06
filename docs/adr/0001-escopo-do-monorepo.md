# ADR 0001 — Monorepo enxuto: só o que já é usado

**Status:** Aceito · Fase 0

## Contexto

A estrutura proposta no briefing previa `apps/desktop`, `apps/local-server`,
`apps/mobile`, `apps/web` e dez pacotes em `packages/` (`ui`, `database`,
`types`, `bible`, `lyrics`, `presentation`, `media`, `websocket`, `sync`,
`config`), além de `docker/` e `scripts/`.

Essa estrutura descreve corretamente o **destino** do projeto. A questão é se ela
deve existir no **começo**.

## Decisão

O monorepo nasce com o que já tem conteúdo real:

```
apps/desktop
packages/types
packages/config
```

Os demais entram na fase que os usa, e o roadmap diz qual é:
`local-server` e a PWA de controle na Fase 3; `sync` na Fase 5. Os pacotes de
domínio (`bible`, `lyrics`, `presentation`, `media`) começam como módulos dentro
de `apps/desktop` e são extraídos quando surgir um segundo consumidor — na
prática, quando o controle remoto precisar compartilhar código.

## Por quê

Um pacote vazio não é neutro. Ele custa um `package.json`, um `tsconfig`, uma
entrada no workspace, uma linha no CI e um lugar a mais para procurar quando algo
quebra. Multiplicado por dez, isso é atrito permanente pago por uma organização
que ainda não é necessária.

Pior: pastas vazias dão a impressão de que a arquitetura está pronta. Ela não
está — ela está _documentada_, que é diferente, e é para isso que serve
[`architecture.md`](../architecture.md).

Extrair um módulo maduro para um pacote é uma refatoração mecânica de meia hora.
Manter dez pacotes vazios por seis meses custa muito mais do que isso.

## Consequências

- Menos arquivos, build mais rápido, menos superfície para errar.
- A fronteira entre domínios passa a ser convenção de módulo, não imposição do
  empacotador. Isso exige disciplina: **domínios não se importam entre si**, e a
  revisão de código precisa cobrar isso.
- Quando o controle remoto chegar (Fase 3), haverá um trabalho real de extração
  do que for compartilhado. É um custo aceito, e previsto.

## Alternativa descartada

Criar toda a estrutura agora com `index.ts` vazios. Rejeitada: viola a regra de
não criar código morto e transfere para o futuro a ilusão de que decisões já
foram tomadas.
