/**
 * Contratos compartilhados do Holy Media.
 *
 * O pacote e' quase inteiramente de tipos, que somem no build. A unica coisa
 * com runtime e' o nome do evento de apresentacao -- uma string que precisa ser
 * a mesma dos dois lados da ponte. Ele existe para que
 * o nucleo Rust, a interface do operador e o controle remoto conversem sobre as
 * mesmas estruturas sem duplicacao.
 *
 * Regra: so entra aqui contrato que ja e' consumido por pelo menos um app.
 * Contratos de fases futuras (protocolo WebSocket, dominio da Biblia) sao
 * adicionados na fase em que forem implementados.
 */

export * from './app.js';
export * from './bible.js';
export * from './display.js';
export * from './errors.js';
export * from './presentation.js';
export * from './services.js';
export * from './songs.js';
