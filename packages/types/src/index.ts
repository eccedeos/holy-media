/**
 * Contratos compartilhados do Holy Media.
 *
 * Este pacote e' *type-only* por design: ele nao carrega runtime, portanto nao
 * pesa no bundle do desktop nem no futuro controle remoto. Ele existe para que
 * o nucleo Rust, a interface do operador e o controle remoto conversem sobre as
 * mesmas estruturas sem duplicacao.
 *
 * Regra: so entra aqui contrato que ja e' consumido por pelo menos um app.
 * Contratos de fases futuras (protocolo WebSocket, dominio de musicas/Biblia)
 * sao adicionados na fase em que forem implementados.
 */

export * from './app.js';
export * from './errors.js';
