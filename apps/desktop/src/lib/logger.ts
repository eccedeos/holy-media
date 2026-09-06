/**
 * Logger da interface (secao 21 do briefing).
 *
 * Objetivos:
 * - niveis DEBUG / INFO / WARN / ERROR com corte configuravel;
 * - escopo por modulo, para separar segunda tela, IPC, banco, importacao;
 * - nunca registrar dado sensivel: quem chama decide o que passa, e existe
 *   uma lista de chaves que sao redigidas automaticamente.
 *
 * Em Fase 0 o destino e' o console. A persistencia em arquivo entra junto com
 * o nucleo Rust que a consome (Fase 1), atras da mesma interface.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/** Chaves cujo valor nunca deve chegar ao log, em qualquer profundidade. */
const REDACTED_KEYS = new Set([
  'password',
  'senha',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'pin',
  'authorization',
  'apikey',
  'pixkey',
  'chavepix',
]);

export const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Substitui valores de chaves sensiveis por um marcador, recursivamente.
 * Ciclos sao cortados para que um objeto auto-referente nao trave o log.
 */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? REDACTED_PLACEHOLDER : redact(item, seen);
  }
  return result;
}

export interface LogRecord {
  readonly level: Exclude<LogLevel, 'silent'>;
  readonly scope: string;
  readonly message: string;
  readonly context?: unknown;
}

/** Destino de um log. Trocavel para testes ou, na Fase 1, para arquivo. */
export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  /** Cria um logger filho com escopo aninhado (`ipc:app_info`). */
  child(scope: string): Logger;
}

const consoleSink: LogSink = ({ level, scope, message, context }) => {
  const prefix = `[${scope}]`;
  if (context === undefined) {
    console[level](prefix, message);
  } else {
    console[level](prefix, message, context);
  }
};

let currentLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'info';
let currentSink: LogSink = consoleSink;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

/** Troca o destino dos logs. Devolve o destino anterior, para restauracao. */
export function setLogSink(sink: LogSink): LogSink {
  const previous = currentSink;
  currentSink = sink;
  return previous;
}

function emit(
  level: Exclude<LogLevel, 'silent'>,
  scope: string,
  message: string,
  context?: unknown,
) {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel]) return;
  currentSink(
    context === undefined
      ? { level, scope, message }
      : { level, scope, message, context: redact(context) },
  );
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, context) => emit('debug', scope, message, context),
    info: (message, context) => emit('info', scope, message, context),
    warn: (message, context) => emit('warn', scope, message, context),
    error: (message, context) => emit('error', scope, message, context),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}
