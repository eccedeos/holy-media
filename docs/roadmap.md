# Roadmap

Uma fase só começa quando a anterior está verde: testes passando, lint limpo,
build funcionando. Fase quebrada não avança.

As Fases 2 a 4 incluem itens de backlog vindos de um levantamento do
concorrente de referência — ver [`holyrics-comparison.md`](holyrics-comparison.md)
para as fontes e o raciocínio de cada um.

---

## Fase 0 — Fundação ✅ concluída

Colocar o projeto de pé, sem nenhuma funcionalidade de produto.

- [x] Monorepo pnpm (`apps/*`, `packages/*`)
- [x] Tauri v2 + Rust configurados e compilando
- [x] React 19 + TypeScript strict + Vite
- [x] TailwindCSS v4 + primitivos no padrão shadcn/ui
- [x] ESLint (flat config) + Prettier + EditorConfig
- [x] Vitest (frontend) e `cargo test` (núcleo) rodando
- [x] Ponte IPC tipada com erros normalizados
- [x] Logger com níveis e redação de dados sensíveis
- [x] ErrorBoundary
- [x] CI no GitHub Actions
- [x] Documentação: arquitetura, roadmap, plano, performance, ADRs

---

## Fase 1 — MVP: dar para fazer um culto inteiro 🚧 em andamento

O critério de pronto é literal: **conseguir conduzir um culto completo usando
apenas este software.**

- [x] SQLite no núcleo Rust + migrations (`user_version`, WAL, chaves estrangeiras)
- [x] Domínio de músicas: criar, ler, editar, excluir
- [x] Letra dividida em slides, com ordem de projeção
- [x] Busca por título, artista, autor, trecho da letra e tag (FTS5, **11 ms** em 5000 músicas)
- [x] Busca sem acento nos dois sentidos ("coracao" ↔ "Coração")
- [x] Favoritos e histórico de uso
- [x] Painel de biblioteca com busca instantânea (debounce + guarda de corrida)
- [x] Formulário de cadastro e edição (letra em texto; linha em branco separa slides)
- [x] Exclusão com confirmação
- [x] Músicas de exemplo, oferecidas na biblioteca vazia
- [x] Módulo de Bíblia: tradução, livro, capítulo, versículo
- [x] Busca bíblica por palavra e por referência
- [x] Presentation Engine (lógica pura, 23 testes)
- [x] Controle da projeção no Control Room: apresentar, avançar, voltar, tela preta
- [x] Segunda tela: janela dedicada, escolha de monitor, tela cheia, sem cursor
- [ ] Backgrounds: cor sólida, gradiente e imagem
- [x] Ordem do culto: adicionar, remover, reordenar, duplicar, salvar, apresentar
- [ ] Slide de texto livre e slide de QR Code (para PIX de ofertas)
- [ ] `KeyboardShortcutService` centralizado

---

## Fase 2 — Multimídia

- [ ] Biblioteca de imagens e mídia local
- [ ] Vídeo na segunda tela
- [ ] Transições simples
- [ ] Tela de espera configurável
- [ ] Layouts de slide (posição do texto, tamanho, contorno)
- [ ] Preview do próximo slide
- [ ] Cronômetro / contagem regressiva como item de apresentação
- [ ] Apresentação automática: avanço temporizado de uma sequência, com
      controle de play/pause (carrossel de imagens, por exemplo)
- [ ] Avisos sobrepostos à projeção — faixa no topo/rodapé, configurável, que
      aparece **sem** interromper o que está no ar

---

## Fase 3 — Controle remoto

- [ ] Servidor local (HTTP + WebSocket) dentro do processo Rust
- [ ] Pareamento por PIN
- [ ] QR Code de conexão exibido no desktop
- [ ] PWA de controle: ver ordem do culto, slide atual, avançar, voltar, preto
- [ ] Selecionar item da playlist e slide específico
- [ ] Protocolo WebSocket documentado e tipado
- [ ] Reconexão automática quando o Wi-Fi oscila
- [ ] Enviar mídia do celular para o computador pela mesma PWA

---

## Fase 4 — Experiência profissional

- [ ] Importadores: TXT, JSON, CSV (interface `LyricsImporter`)
- [ ] Backup, restauração e exportação
- [ ] Temas e atalhos configuráveis
- [ ] Suporte a mais de dois monitores, incluindo uma saída via navegador HTTP
      na rede local (útil para uma Smart TV, sem instalar nada nela)
- [ ] Monitor de retorno (stage display) para músicos e pregador — uma
      **terceira saída** do motor de apresentação, distinta da tela da
      congregação: tema e layout próprios, prévia do próximo slide, contagem
      de slides, e comentários (cifra, nota) visíveis só ali, nunca no telão
- [ ] Metadados de música para quem toca: tom (key) e BPM
- [ ] Relatório de músicas executadas, filtrável por culto — consulta sobre o
      histórico de uso que já existe desde a Fase 1
- [ ] Utilitário para mesclar músicas duplicadas na biblioteca
- [ ] Sub-itens colapsáveis e campo de descrição na ordem do culto

Integrações externas — superfície de extensão para o ecossistema de produção
ao vivo que já cresce ao redor de igrejas (identificado no comparativo com o
Holyrics: OBS Studio, VLC, apps de click-track como o Playback da MultiTracks):

- [ ] Servidor de API com token de acesso, além do WebSocket da Fase 3
- [ ] Hook de script customizável para reagir a eventos do motor
- [ ] Troca de cena no OBS Studio disparada pelo que está sendo projetado

---

## Fase 5 — Nuvem

- [ ] Conta e login
- [ ] PostgreSQL no servidor
- [ ] Sincronização da biblioteca entre máquinas
- [ ] Backup automático
- [ ] Biblioteca online de músicas (com licenciamento adequado)

---

## Fase 6 — SaaS

- [ ] Multi-tenant (organizações / igrejas)
- [ ] Usuários e permissões
- [ ] Planos e cobrança
- [ ] Painel administrativo

Regra permanente: **uma igreja nunca acessa dados de outra.** O isolamento é
verificado por teste, não por convenção.

---

## Fase 7 — IA (exploratória)

Nada aqui está comprometido. São hipóteses a validar com igrejas de verdade
antes de virar escopo:

- Sugerir músicas por tema do culto
- Encontrar músicas relacionadas
- Sugerir versículos para um tema
- Transformar um roteiro de sermão em slides
- Assistente para o operador durante o culto
