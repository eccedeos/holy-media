import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PresentationState } from '@holy-media/types';
import { ProjectionScreen } from './projection-screen';
import { resetPresentationStore, usePresentationStore } from '@/store/presentation-store';
import * as api from '@/lib/presentation-api';

vi.mock('@/lib/presentation-api');

function estado(overrides: Partial<PresentationState> = {}): PresentationState {
  return {
    output: { kind: 'slide', content: 'Primeira estrofe' },
    sourceId: 'musica-1',
    title: 'Grande e o Senhor',
    label: 'Verso 1',
    index: 0,
    total: 4,
    blackedOut: false,
    canGoNext: true,
    canGoPrevious: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetPresentationStore();
  vi.mocked(api.onPresentationState).mockResolvedValue(() => {});
  vi.mocked(api.fetchPresentationState).mockResolvedValue(estado());
});

describe('ProjectionScreen', () => {
  it('mostra o conteudo do slide', () => {
    usePresentationStore.setState({ state: estado() });

    render(<ProjectionScreen />);

    expect(screen.getByText('Primeira estrofe')).toBeInTheDocument();
  });

  it('nao mostra titulo, marcacao nem posicao', () => {
    usePresentationStore.setState({
      state: estado({ title: 'Grande e o Senhor', label: 'Refrao', index: 2, total: 4 }),
    });

    const { container } = render(<ProjectionScreen />);

    // Qualquer um destes na tela seria um erro visivel para a igreja inteira.
    expect(container).not.toHaveTextContent('Grande e o Senhor');
    expect(container).not.toHaveTextContent('Refrao');
    expect(container).not.toHaveTextContent('3 de 4');
  });

  it('nao mostra nada com a tela preta', () => {
    usePresentationStore.setState({
      state: estado({ output: { kind: 'black' }, blackedOut: true }),
    });

    const { container } = render(<ProjectionScreen />);

    expect(container).not.toHaveTextContent('Primeira estrofe');
    expect(container.textContent).toBe('');
  });

  it('nao mostra nada sem apresentacao carregada', () => {
    usePresentationStore.setState({ state: estado({ output: { kind: 'idle' }, total: 0 }) });

    const { container } = render(<ProjectionScreen />);

    expect(container.textContent).toBe('');
  });

  it('preserva a quebra de linha da letra', () => {
    usePresentationStore.setState({
      state: estado({ output: { kind: 'slide', content: 'Primeira linha\nSegunda linha' } }),
    });

    render(<ProjectionScreen />);

    // Sem `whitespace-pre-wrap` os versos virariam um paragrafo corrido.
    const texto = screen.getByText(/Primeira linha/);
    expect(texto).toHaveClass('whitespace-pre-wrap');
  });

  it('assina o estado do nucleo ao montar e cancela ao desmontar', async () => {
    const unlisten = vi.fn();
    vi.mocked(api.onPresentationState).mockResolvedValue(unlisten);

    const { unmount } = render(<ProjectionScreen />);
    await vi.waitFor(() => expect(api.onPresentationState).toHaveBeenCalled());

    unmount();
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalled());
  });
});
