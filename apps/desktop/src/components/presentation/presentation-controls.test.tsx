import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PresentationState } from '@holy-media/types';
import { PresentationControls } from './presentation-controls';
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
});

describe('previa', () => {
  it('mostra o conteudo que esta na tela', () => {
    usePresentationStore.setState({ state: estado() });

    render(<PresentationControls />);

    expect(screen.getByLabelText('Previa da projecao')).toHaveTextContent('Primeira estrofe');
  });

  it('nao projeta a marcacao do slide', () => {
    usePresentationStore.setState({ state: estado({ label: 'Refrao' }) });

    render(<PresentationControls />);

    // "Refrao" orienta o operador e aparece fora da previa; dentro dela seria
    // um erro visivel para a congregacao inteira.
    expect(screen.getByLabelText('Previa da projecao')).not.toHaveTextContent('Refrao');
    expect(screen.getByText(/Refrao/)).toBeInTheDocument();
  });

  it('mostra a tela preta em vez do conteudo', () => {
    usePresentationStore.setState({
      state: estado({ output: { kind: 'black' }, blackedOut: true }),
    });

    render(<PresentationControls />);

    const previa = screen.getByLabelText('Previa da projecao');
    expect(previa).toHaveTextContent('tela preta');
    expect(previa).not.toHaveTextContent('Primeira estrofe');
  });

  it('avisa quando nao ha nada no ar', () => {
    render(<PresentationControls />);

    expect(screen.getByLabelText('Previa da projecao')).toHaveTextContent('nada no ar');
  });
});

describe('comandos', () => {
  it('avanca e volta o slide', async () => {
    const user = userEvent.setup();
    usePresentationStore.setState({ state: estado({ index: 1, canGoPrevious: true }) });
    // O estado devolvido precisa ser coerente: no indice 2 da' para voltar.
    // Um `canGoPrevious: false` aqui seria um estado que o motor nunca produz.
    vi.mocked(api.presentationNext).mockResolvedValue(estado({ index: 2, canGoPrevious: true }));
    vi.mocked(api.presentationPrevious).mockResolvedValue(
      estado({ index: 1, canGoPrevious: true }),
    );

    render(<PresentationControls />);
    await user.click(screen.getByRole('button', { name: 'Proximo slide' }));
    await waitFor(() => expect(api.presentationNext).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Slide anterior' }));
    await waitFor(() => expect(api.presentationPrevious).toHaveBeenCalled());
  });

  it('desabilita os botoes segundo os limites que o nucleo informou', () => {
    usePresentationStore.setState({
      state: estado({ index: 3, canGoNext: false, canGoPrevious: true }),
    });

    render(<PresentationControls />);

    expect(screen.getByRole('button', { name: 'Proximo slide' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Slide anterior' })).toBeEnabled();
  });

  it('a tela preta aparece pressionada quando esta ativa', () => {
    usePresentationStore.setState({
      state: estado({ output: { kind: 'black' }, blackedOut: true }),
    });

    render(<PresentationControls />);

    expect(screen.getByRole('button', { name: /Preto/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('tirar do ar so fica disponivel com algo carregado', async () => {
    const user = userEvent.setup();
    render(<PresentationControls />);
    expect(screen.getByRole('button', { name: 'Tirar do ar' })).toBeDisabled();

    usePresentationStore.setState({ state: estado() });
    vi.mocked(api.presentationClear).mockResolvedValue(
      estado({ output: { kind: 'idle' }, total: 0, sourceId: null }),
    );
    await user.click(screen.getByRole('button', { name: 'Tirar do ar' }));

    await waitFor(() => expect(api.presentationClear).toHaveBeenCalled());
  });

  it('mostra a posicao para o operador se situar', () => {
    usePresentationStore.setState({ state: estado({ index: 2, total: 4, label: 'Verso 2' }) });

    render(<PresentationControls />);

    expect(screen.getByText(/3 de 4/)).toBeInTheDocument();
  });
});
