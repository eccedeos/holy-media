import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLogger,
  redact,
  setLogLevel,
  setLogSink,
  REDACTED_PLACEHOLDER,
  type LogRecord,
} from './logger';

function captureLogs(): LogRecord[] {
  const records: LogRecord[] = [];
  setLogSink((record) => records.push(record));
  return records;
}

describe('redact', () => {
  it('mantem valores nao sensiveis', () => {
    expect(redact({ command: 'app_info', count: 2 })).toEqual({ command: 'app_info', count: 2 });
  });

  it('remove valores de chaves sensiveis', () => {
    expect(redact({ pin: '482913', senha: 'x', token: 'y' })).toEqual({
      pin: REDACTED_PLACEHOLDER,
      senha: REDACTED_PLACEHOLDER,
      token: REDACTED_PLACEHOLDER,
    });
  });

  it('ignora diferenca de caixa na chave', () => {
    expect(redact({ Authorization: 'Bearer abc' })).toEqual({
      Authorization: REDACTED_PLACEHOLDER,
    });
  });

  it('desce por objetos aninhados e arrays', () => {
    expect(redact({ devices: [{ name: 'celular', pin: '1234' }] })).toEqual({
      devices: [{ name: 'celular', pin: REDACTED_PLACEHOLDER }],
    });
  });

  it('nao entra em loop com referencia circular', () => {
    const node: Record<string, unknown> = { name: 'raiz' };
    node.self = node;
    expect(redact(node)).toEqual({ name: 'raiz', self: '[Circular]' });
  });
});

describe('createLogger', () => {
  beforeEach(() => {
    setLogLevel('debug');
  });

  it('emite o registro com nivel e escopo', () => {
    const records = captureLogs();
    createLogger('ipc').info('conectado');
    expect(records).toEqual([{ level: 'info', scope: 'ipc', message: 'conectado' }]);
  });

  it('silencia niveis abaixo do corte configurado', () => {
    const records = captureLogs();
    setLogLevel('warn');
    const log = createLogger('ipc');
    log.debug('detalhe');
    log.info('rotina');
    log.warn('atencao');
    expect(records.map((record) => record.level)).toEqual(['warn']);
  });

  it('aninha o escopo em loggers filhos', () => {
    const records = captureLogs();
    createLogger('ipc').child('app_info').debug('chamada');
    expect(records[0]?.scope).toBe('ipc:app_info');
  });

  it('redige o contexto antes de entregar ao destino', () => {
    const records = captureLogs();
    createLogger('remote').warn('pareamento recusado', { pin: '482913' });
    expect(records[0]?.context).toEqual({ pin: REDACTED_PLACEHOLDER });
  });
});
