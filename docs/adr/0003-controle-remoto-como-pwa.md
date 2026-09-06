# ADR 0003 — Controle remoto nasce como PWA, não como app nativo

**Status:** Aceito · Fase 0 (implementação na Fase 3)

## Contexto

Controlar a projeção pelo celular é um dos principais diferenciais do produto. A
pergunta é por onde começar: aplicativo nativo (React Native) ou página web
responsiva servida pelo próprio desktop.

## Decisão

O controle remoto começa como **PWA servida pelo servidor local do desktop**,
acessada pelo navegador do celular via QR Code exibido na tela do operador.

Aplicativo nativo fica para depois de o remoto estar validado em uso real — e só
se houver motivo concreto, como notificação em segundo plano ou acesso a
hardware.

## Por quê

**Distribuição.** Um app nativo exige App Store e Play Store: contas de
desenvolvedor, revisão, ciclo de publicação, e um usuário que precisa instalar
algo antes de conseguir ajudar no culto. A PWA é um QR Code apontado para
`http://192.168.0.x:3000` — quem chega para operar naquele domingo está
conectado em dez segundos.

**Atualização.** O desktop serve a PWA. Atualizar o desktop atualiza o controle
remoto, sem descompasso de versão entre o que o celular manda e o que o servidor
entende. Com app nativo, alguém sempre está numa versão antiga.

**Custo.** Uma base de código a menos para manter, testar e publicar em duas
lojas — numa fase em que o produto ainda está descobrindo o que o operador
realmente precisa.

**O caso de uso permite.** O celular fica na rede Wi-Fi da igreja, na mesma sala,
com a tela ligada, por uma hora. Não precisa de background, nem de push, nem de
armazenamento offline sofisticado. É o cenário em que a PWA é praticamente
equivalente ao nativo.

## Consequências

- O protocolo WebSocket precisa ser público e versionado desde o início, porque
  um dia um cliente nativo vai falar com ele.
- A interface do remoto é projetada para toque: alvos grandes, alto contraste,
  legível no escuro, e nenhuma ação destrutiva a um toque de distância.
- Reconexão automática é obrigatória: Wi-Fi de igreja oscila, e o operador não
  pode descobrir isso no meio de uma música.
- iOS limita algumas APIs de PWA. Nenhuma delas é necessária para avançar slide.

## Quando reconsiderar

Se o uso real mostrar necessidade de operação com a tela bloqueada, de
notificação em segundo plano, ou de descoberta automática do desktop sem QR
Code, o app nativo volta à mesa — e reaproveita o protocolo inteiro.
