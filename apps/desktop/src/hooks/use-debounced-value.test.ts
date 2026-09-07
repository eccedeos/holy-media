import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './use-debounced-value';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('devolve o valor inicial de imediato', () => {
    const { result } = renderHook(() => useDebouncedValue('inicial', 250));
    expect(result.current).toBe('inicial');
  });

  it('so propaga o valor depois do atraso', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(249));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  it('mudanca rapida produz um unico valor final, nao um por tecla', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: '' },
    });

    // Sete teclas em 70 ms -- digitacao normal de quem tem pressa.
    for (const parcial of ['a', 'al', 'ale', 'alel', 'alelu', 'alelui', 'aleluia']) {
      rerender({ value: parcial });
      act(() => vi.advanceTimersByTime(10));
    }

    expect(result.current, 'nada deveria ter propagado ainda').toBe('');

    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe('aleluia');
  });
});
