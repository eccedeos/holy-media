# Busca de letra online

Botão "Buscar" no formulário de cadastro/edição de música
(`components/songs/song-form.tsx`), ao lado do campo de texto onde a letra
já era colada manualmente. Não é uma fonte de dados nova — é um jeito mais
rápido de chegar ao mesmo texto que antes só entrava por colar.

## A decisão de risco

Duas fontes foram avaliadas a pedido do operador do projeto:

| Fonte                       | Problema                                                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lyrics.com/lyrics_api.php` | Endpoint interno não documentado de um site comercial, com histórico de disputas sobre direitos de letras.                                                     |
| `lrclib.net`                | Software do servidor em licença aberta, mas as letras que ele indexa são enviadas por usuários, sem garantia de que quem enviou tinha o direito de fazer isso. |

Nenhuma das duas garante direitos sobre o conteúdo — ao contrário da Tradução
Brasileira embutida em `bible::seed` (dominio público verificado na fonte,
ver [`bible.md`](bible.md)), aqui não há essa verificação possível: letra de
música não tem um registro central e público de status de direitos como uma
tradução bíblica antiga tem.

**A decisão de implementar mesmo assim, usando o `lrclib.net` (o de menor
risco relativo dos dois), foi tomada explicitamente pelo operador do
projeto**, depois de ouvir os dois lados — não é uma escolha técnica
silenciosa. Fica registrada aqui para não se perder: se uma igreja levantar
uma dúvida sobre uma letra específica, a origem e o raciocínio estão
documentados.

Por isso a busca nunca salva nada por conta própria: o resultado preenche o
formulário (título, artista e letra, só quando esses campos ainda estão
vazios) e o operador confirma — ou edita, ou descarta — antes de clicar em
Salvar, exatamente como se tivesse colado o texto manualmente. A
responsabilidade pelo conteúdo continua sendo de quem o usa (README, "Sobre
conteúdo de terceiros").

## Como funciona

`lyrics::search` (`src-tauri/src/lyrics/mod.rs`) chama
`GET https://lrclib.net/api/search?q=<busca>`, descarta faixas instrumentais
e faixas sem `plainLyrics`, e devolve no máximo 20 resultados.

O comando (`commands::lyrics::lyrics_search`) é `async` e roda a chamada
bloqueante (`ureq`) via `spawn_blocking`, de propósito: um comando síncrono
bloquearia a thread que processa IPC pelo tempo da requisição de rede — a
mesma classe de problema que travava a janela de projeção no Windows (ver
`display::open` e o registro do bug em
[`roteiro-teste-real.md`](roteiro-teste-real.md)), só que disparada por uma
rede lenta em vez de uma chamada de janela nativa.

Não verificável neste ambiente de desenvolvimento: o acesso a `lrclib.net` é
bloqueado pelo proxy da sandbox onde este projeto é editado. O formato da
resposta foi conferido contra a documentação pública do serviço, não contra
uma chamada real — a primeira verificação de ponta a ponta acontece no
instalador gerado pelo GitHub Actions, com o operador testando de verdade.
