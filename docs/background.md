# Fundo, texto avulso e QR Code

Os três últimos blocos de conteúdo da Fase 1: o fundo da projeção (cor
sólida, gradiente ou imagem), um slide de texto digitado na hora, e um QR
Code — o caso de uso pedido no roadmap é a chave PIX da oferta, mas o
payload é texto livre, então serve para qualquer URL ou código.

## Fundo

Vive em `apps/desktop/src-tauri/src/background/`. Uma única linha no banco
(`background_settings`, id fixo `'current'`): a Fase 1 tem um operador só e
um fundo no ar por vez. Múltiplos fundos salvos para alternar durante o
culto — um para os avisos, outro para a pregação — ficam para quando isso
for pedido de verdade; hoje seria complexidade sem uso comprovado.

### Por que a imagem mora no banco, não em disco

A imagem de fundo é guardada como _data URL_ (base64) direto na coluna
`image_data`, nunca como caminho de arquivo. A alternativa óbvia — salvar em
disco e servir por caminho — abriria uma superfície de permissão nova do
Tauri v2 (escopo de asset, capability por diretório) só para uma imagem de
fundo, quando o produto já tem exatamente o mecanismo certo para isso: o
IPC que toda outra tela usa. O custo é ~33% de inflação de tamanho (base64) e
a imagem inteira na memória de duas janelas ao mesmo tempo — aceitável para
uma imagem de fundo (uma só, não uma galeria), com um limite de tamanho
aplicado no núcleo (`MAX_IMAGE_DATA_LEN` em `background/model.rs`, ~6 MB já
em base64) para um arquivo escolhido por engano não inchar as duas janelas.

### Onde o fundo aparece — e onde não aparece

O fundo configurado só entra atrás de conteúdo **no ar** (`Output::Slide` e
`Output::Qr`). Os estados `idle` (espera) e `black` (tela preta pedida pelo
operador) continuam pretos sólidos, de propósito: a tela preta é o controle
de emergência do operador, e perderia a função se deixasse uma imagem ou
gradiente "vazar" atrás. Ver o teste
`tela_preta_esconde_o_qr_code_tambem` em `presentation/tests.rs` e o
comentário equivalente em `projection-screen.tsx`.

A troca de fundo é aplicada imediatamente ao trocar de aba (Cor/Gradiente/
Imagem) ou ao arrastar um controle — não há um botão "Salvar" separado,
no mesmo padrão já usado para escolher o monitor de projeção. Cada campo é
enviado com um `debounce` (`useDebouncedValue`, o mesmo hook da busca) para
não disparar uma chamada IPC por pixel arrastado no seletor de cor.

## Texto avulso

`presentation_present_text` em `commands/presentation.rs`. Um bloco de texto
digitado na hora (aviso, oração, lembrete), dividido em slides pela mesma
regra já usada no cadastro de música — linha em branco separa slide
(`parseLyrics`, em `lib/lyrics.ts`) — para quem já aprendeu essa convenção
não precisar aprender uma segunda.

**Deliberadamente sem persistência.** Não existe uma "biblioteca de
avisos": o texto é o equivalente de um bilhete escrito na hora, não uma
música que devesse entrar num cadastro. Isso também mantém o `source_id`
simples — um UUID novo (`text:<uuid>`) a cada apresentação, sem precisar de
uma tabela para guardar de onde ele veio.

## QR Code

`presentation_present_qr` em `commands/presentation.rs`. Um único slide cujo
`content` é o _payload_ (a chave PIX, a URL) — nunca o desenho do código.
Quem transforma payload em imagem é a tela de projeção
(`components/presentation/qr-code.tsx`, com a biblioteca `qrcode-generator`,
~10 kB gzip no bundle final, sem dependências), nunca o núcleo: o motor de
apresentação continua sem saber o que é um QR Code, só que este slide tem
`kind: Qr` em vez de `kind: Text` — a mesma distinção que `Output` já fazia
entre `Idle`/`Black`/`Slide`, agora com um quarto formato de exibição.

Essa fronteira (payload no núcleo, desenho na tela) é a mesma já usada para
Escritura: o dado que atravessa o IPC é sempre a fonte da verdade, nunca uma
representação já processada — mandar o payload é mais barato (texto é muito
menor que um SVG já desenhado) e mais correto (o desenho é recalculado a
cada abertura da janela, nunca fica desatualizado em relação ao payload).

O painel de composição (`components/qr/qr-panel.tsx`) mostra uma prévia do
QR Code **antes** de apresentar, com o mesmo componente que a tela real usa
— um código errado na frente da igreja não tem como ser corrigido rápido, e
a prévia é a chance de conferir que ele escaneia certo.

## Limitações conhecidas

- Um fundo só por vez, sem galeria de fundos salvos para alternar.
- Texto avulso e QR Code não entram na ordem do culto — são apresentação
  imediata, como uma referência bíblica buscada na hora. Prepará-los com
  antecedência dentro da playlist (como já é possível com música) é trabalho
  futuro, e vale também para a Bíblia, que também ainda não entra na ordem
  do culto.
- Sem editor de posição/tamanho para a imagem de fundo (sempre `cover`,
  centralizada) — layouts de slide são explicitamente Fase 2.
