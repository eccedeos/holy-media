# Comparativo com o Holyrics

Levantamento pontual, feito antes de retomar a Fase 1, para checar que o
roadmap não estava deixando de fora algo relevante do concorrente de
referência do projeto — sem a intenção de copiá-lo (ver a introdução do
[roadmap](roadmap.md) e o princípio geral do projeto de superá-lo, não
replicá-lo).

## Limitação da pesquisa

`holyrics.com.br` está bloqueado pela política de rede deste ambiente de
desenvolvimento (bloqueio confirmado no gateway de saída, não no navegador ou
na ferramenta de busca). Não há acesso à documentação oficial completa. O
levantamento abaixo vem de busca web — tutoriais de terceiros, o changelog
divulgado em vídeos e fóruns, e os repositórios públicos do Holyrics no
GitHub (`holyrics/API-Server`, `holyrics/jslib`) — cruzando várias fontes
para reduzir o risco de erro de uma fonte isolada. Trate como um mapa
aproximado, não como especificação.

## Uma suposição corrigida

O Holyrics **já é multiplataforma** (Windows, macOS, Linux). Cross-platform
não é, por si só, um diferencial do Holy Media — a vantagem real continua
sendo o peso (o orçamento de RAM medido em `performance.md`) e a arquitetura
preparada para SaaS, não a mera existência em três sistemas operacionais.

## Funcionalidades identificadas que o Holy Media ainda não tem

### Já cobertas pelo roadmap existente

Bíblia, backgrounds animados/vídeo, slide de QR Code, importadores em lote,
temas, atalhos configuráveis, controle remoto via PWA — nenhuma surpresa
aqui, só confirma a ordem já planejada.

### Capacidades novas, adicionadas ao backlog (Fases 2–4)

- **Monitor de retorno (stage display)** — uma terceira saída do motor de
  apresentação, distinta da tela da congregação: tema próprio, prévia do
  próximo slide, contagem de slides, e comentários (cifra, nota para o
  músico) visíveis só ali.
- **Avisos sobrepostos à projeção** — faixa configurável que aparece sem
  interromper o que está no ar.
- **Cronômetro / contagem regressiva** e **apresentação automática** (avanço
  temporizado com play/pause) como itens de apresentação nativos.
- **Metadados de música para quem toca**: tom (key) e BPM.
- **Relatório de músicas executadas**, filtrável por culto.
- **Mesclar músicas duplicadas** na biblioteca.
- **Sub-itens colapsáveis e descrição** na ordem do culto.
- **Múltiplas telas extras**, incluindo saída via navegador HTTP na rede
  local (útil para uma Smart TV sem instalar nada).
- **Enviar mídia do celular para o computador** pela PWA de controle.
- **Integrações externas**: servidor de API com token, hook de script
  customizável, e troca de cena no OBS Studio disparada pela apresentação —
  o Holyrics também integra com VLC e com o app de click-track Playback
  (MultiTracks), sinal de que existe um ecossistema de produção ao vivo ao
  redor de igrejas que vale a pena poder plugar depois.

### Confirma decisões já tomadas, não motivo para mudar nada

- **Busca de letras na internet embutida no app**: o Holyrics tem, mas com
  uma página de aviso legal dedicada sobre direitos autorais. É sinal de
  risco jurídico, não de funcionalidade a copiar — a decisão deste projeto
  de não fazer scraping de letras (ver README, seção de licenciamento)
  segue de pé.
- **Parceria com a Sociedade Bíblica do Brasil (SBB) para traduções**: por
  relatos de terceiros, começou sem autorização formal e teve que ser
  regularizada depois. Reforça exatamente o cuidado que o
  [ADR 0002](adr/0002-acesso-a-dados-sqlite-sem-orm.md) e a seção de Bíblia
  do roadmap já preveem — nenhuma tradução é distribuída sem licença
  verificada antes.
- **PIX/QR Code**: não foi encontrado um gerador nativo — parece ser um slide
  de imagem comum, com o QR Code colado pelo usuário. O plano já existente do
  Holy Media (slide de QR Code onde o operador fornece a imagem) já cobre
  isso; não é necessário construir um gerador de QR/PIX de verdade.

## Onde essas entradas foram para o roadmap

Fase 2, Fase 3 e Fase 4 de [`roadmap.md`](roadmap.md) — nenhuma mudou a ordem
das fases já em andamento (Bíblia continua sendo o próximo passo da Fase 1).
