# Roteiro de teste real

A Fase 1 terminou com tudo verde em teste automatizado e verificado sob
Xvfb, com dados de exemplo. Isso prova que o código faz o que os testes
descrevem — não prova que ele aguenta um culto de verdade, num PC de
verdade, com um operador que não escreveu uma linha dele. Este roteiro é
para isso.

**Regra de ouro:** qualquer travamento, lentidão, tela confusa ou "eu não
sabia que dava para fazer isso" é um resultado válido do teste — anote
tudo, mesmo o que parecer bobagem. É exatamente o que uma bateria de testes
automatizados não alcança.

## Antes de começar

- [ ] Build gerado (ver [`build-instaladores.md`](build-instaladores.md)
      para Windows/macOS; os pacotes Linux já saem deste ambiente).
- [ ] Instalado numa máquina que **não** é a de desenvolvimento — de
      preferência o PC mais fraco que a igreja realmente usa.
- [ ] Um segundo monitor ou projetor conectado, se possível — o Xvfb deste
      ambiente nunca testou isso de verdade (ver "Não verificado" em
      [`implementation-plan.md`](implementation-plan.md), passo 4).

## 1. Primeira abertura

- [ ] O aplicativo abre sem erro, biblioteca vazia, oferece "Adicionar
      músicas de exemplo".
- [ ] Meça a RAM em repouso (ver comandos em
      [`performance.md`](performance.md)) e compare com os números já
      registrados lá. Bem diferente do esperado é sinal de investigar antes
      de seguir.

## 2. Músicas

- [ ] Cadastrar uma música colando uma letra real, com linha em branco
      separando estrofes e refrão.
- [ ] Editar a letra de uma música já salva.
- [ ] Buscar por título, por um trecho da letra, e sem acento (ex.: buscar
      "coracao" e encontrar "Coração").
- [ ] Favoritar uma música e confirmar que ela aparece marcada.
- [ ] Excluir uma música (com a confirmação aparecendo antes).

## 3. Bíblia

- [ ] Importar uma tradução que a igreja tenha o direito de usar (formato
      em [`bible.md`](bible.md) — **nenhuma tradução vem com o
      instalador**, de propósito).
- [ ] Navegar por livro e capítulo.
- [ ] Buscar por referência ("João 3:16", "Salmos 23").
- [ ] Buscar por palavra.
- [ ] Apresentar um versículo único, uma faixa de versículos, e um capítulo
      inteiro.

## 4. Ordem do culto

- [ ] Montar a ordem de um culto real (abertura, algumas músicas, um
      momento de oferta, encerramento).
- [ ] Reordenar itens arrastando/movendo, duplicar um item, remover outro.
- [ ] Percorrer a ordem do culto inteira apresentando cada item pela lista,
      do primeiro ao último, como aconteceria de verdade.

## 5. Fundo, texto avulso e QR Code

- [ ] Trocar o fundo para uma cor, depois um gradiente, depois uma imagem
      de verdade (uma foto da igreja, por exemplo).
- [ ] Confirmar que a tela preta continua preta mesmo com o fundo
      configurado (aperte "Preto" com um fundo de imagem ativo).
- [ ] Apresentar um texto avulso (um aviso real do culto).
- [ ] Gerar um QR Code com a chave PIX real da igreja e **escanear com um
      celular de verdade** para confirmar que o código funciona — a prévia
      no aplicativo não substitui isso.

## 6. Projeção de verdade

- [ ] Abrir a segunda tela num monitor ou projetor real (não o Xvfb).
- [ ] Confirmar tela cheia, sem cursor, sem nenhuma barra ou menu visível.
- [ ] Avançar e voltar slides com a congregação (ou alguém) olhando a
      projeção, não só a prévia do Control Room.
- [ ] Testar o aviso de "este monitor é o do operador" ao tentar projetar
      na tela errada.

## 7. Atalhos de teclado

- [ ] Usar seta direita/esquerda, `B` e `Escape` durante uma apresentação
      real, sem olhar para o teclado.
- [ ] Confirmar que digitar numa busca (título de música, palavra na
      Bíblia) nunca aciona um atalho por engano.
- [ ] Reatribuir um atalho no painel "Atalhos" e confirmar que a nova tecla
      funciona.

## 8. Um culto do início ao fim

Esta é a verificação que dá nome à Fase 1 — "conseguir conduzir um culto
completo usando apenas este software":

- [ ] Conduza um culto (ou um ensaio bem realista) inteiro, do primeiro
      item da ordem do culto ao encerramento, sem sair do aplicativo para
      nenhuma outra ferramenta.
- [ ] Meça RAM e CPU **durante** o uso real (não só em repouso) e compare
      com o orçamento em [`performance.md`](performance.md).
- [ ] Anote qualquer momento de hesitação do operador — não só bugs. "Não
      sabia onde clicar" é um resultado tão válido quanto um erro na tela.

## Depois do teste

Registre o que foi encontrado (bugs, confusões de interface, ideias) antes
de decidir os próximos passos. Um bug real encontrado aqui é trabalho para
antes da Fase 2, não depois — o critério de pronto da Fase 1 só vale se
resistir ao uso real, não só ao teste automatizado.
