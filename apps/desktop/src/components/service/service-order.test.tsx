import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Service, ServiceSummary } from '@holy-media/types';
import { ServiceOrder } from './service-order';
import { resetServicesStore, useServicesStore } from '@/store/services-store';
import { resetPresentationStore, usePresentationStore } from '@/store/presentation-store';
import * as servicesApi from '@/lib/services-api';
import * as presentationApi from '@/lib/presentation-api';

vi.mock('@/lib/services-api');
vi.mock('@/lib/presentation-api');

function resumo(id: string, title: string, itemCount = 0): ServiceSummary {
  return { id, title, itemCount, updatedAt: 1 };
}

function servico(id: string, title: string, items: Service['items'] = []): Service {
  return { id, title, items, createdAt: 1, updatedAt: 1 };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetServicesStore();
  resetPresentationStore();
  vi.mocked(servicesApi.listServices).mockResolvedValue([]);
});

describe('sem culto ativo', () => {
  it('oferece criar um novo culto', async () => {
    const user = userEvent.setup();
    vi.mocked(servicesApi.createService).mockResolvedValue(servico('1', 'Culto de Domingo'));

    render(<ServiceOrder />);
    await user.type(screen.getByLabelText('Titulo da nova ordem do culto'), 'Culto de Domingo');
    await user.click(screen.getByRole('button', { name: /Criar/ }));

    await waitFor(() =>
      expect(servicesApi.createService).toHaveBeenCalledWith({ title: 'Culto de Domingo' }),
    );
  });

  it('lista os cultos salvos para reabrir', async () => {
    const user = userEvent.setup();
    vi.mocked(servicesApi.listServices).mockResolvedValue([resumo('1', 'Culto de Domingo', 3)]);
    vi.mocked(servicesApi.getService).mockResolvedValue(servico('1', 'Culto de Domingo'));

    render(<ServiceOrder />);
    await user.click(await screen.findByText('Culto de Domingo'));

    await waitFor(() => expect(servicesApi.getService).toHaveBeenCalledWith('1'));
  });
});

describe('com culto ativo', () => {
  function itensDeExemplo() {
    return [
      { id: 'i1', position: 0, kind: 'song' as const, referenceId: 's1', title: 'Primeira' },
      { id: 'i2', position: 1, kind: 'song' as const, referenceId: 's2', title: 'Segunda' },
      { id: 'i3', position: 2, kind: 'song' as const, referenceId: 's3', title: 'Terceira' },
    ];
  }

  it('mostra os itens na ordem', () => {
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });

    render(<ServiceOrder />);

    const linhas = screen.getAllByRole('button', { name: /^\d\./ });
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      '1. Primeira',
      '2. Segunda',
      '3. Terceira',
    ]);
  });

  it('apresenta a musica ao clicar no item', async () => {
    const user = userEvent.setup();
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });
    vi.mocked(presentationApi.presentSong).mockResolvedValue({
      output: { kind: 'idle' },
      sourceId: 's2',
      title: 'Segunda',
      label: '',
      index: 0,
      total: 1,
      blackedOut: false,
      canGoNext: false,
      canGoPrevious: false,
    });

    render(<ServiceOrder />);
    await user.click(screen.getByRole('button', { name: '2. Segunda' }));

    await waitFor(() => expect(presentationApi.presentSong).toHaveBeenCalledWith('s2'));
  });

  it('destaca o item que corresponde a musica no ar', () => {
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });
    usePresentationStore.setState({
      state: {
        output: { kind: 'slide', content: 'x' },
        sourceId: 's2',
        title: 'Segunda',
        label: '',
        index: 0,
        total: 1,
        blackedOut: false,
        canGoNext: false,
        canGoPrevious: false,
      },
    });

    render(<ServiceOrder />);

    expect(screen.getByRole('button', { name: '2. Segunda' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: '1. Primeira' })).not.toHaveAttribute('aria-current');
  });

  it('remove um item', async () => {
    const user = userEvent.setup();
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });
    vi.mocked(servicesApi.removeServiceItem).mockResolvedValue(servico('1', 'Culto'));

    render(<ServiceOrder />);
    await user.click(screen.getByRole('button', { name: 'Remover Primeira' }));

    await waitFor(() => expect(servicesApi.removeServiceItem).toHaveBeenCalledWith('1', 'i1'));
  });

  it('duplica um item', async () => {
    const user = userEvent.setup();
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });
    vi.mocked(servicesApi.duplicateServiceItem).mockResolvedValue(servico('1', 'Culto'));

    render(<ServiceOrder />);
    await user.click(screen.getByRole('button', { name: 'Duplicar Segunda' }));

    await waitFor(() => expect(servicesApi.duplicateServiceItem).toHaveBeenCalledWith('1', 'i2'));
  });

  it('move um item para cima e para baixo', async () => {
    const user = userEvent.setup();
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });
    // O mock devolve a mesma lista de itens; o que se verifica aqui e' o
    // argumento enviado ao comando, nao o resultado apos a resposta.
    vi.mocked(servicesApi.moveServiceItem).mockResolvedValue(
      servico('1', 'Culto', itensDeExemplo()),
    );

    render(<ServiceOrder />);
    await user.click(screen.getByRole('button', { name: 'Mover Segunda para cima' }));
    await waitFor(() => expect(servicesApi.moveServiceItem).toHaveBeenCalledWith('1', 'i2', 0));

    await user.click(screen.getByRole('button', { name: 'Mover Segunda para baixo' }));
    await waitFor(() => expect(servicesApi.moveServiceItem).toHaveBeenCalledWith('1', 'i2', 2));
  });

  it('desabilita mover para cima no primeiro item e para baixo no ultimo', () => {
    useServicesStore.setState({ active: servico('1', 'Culto', itensDeExemplo()) });

    render(<ServiceOrder />);

    expect(screen.getByRole('button', { name: 'Mover Primeira para cima' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mover Terceira para baixo' })).toBeDisabled();
  });

  it('mostra mensagem quando o culto ainda nao tem itens', () => {
    useServicesStore.setState({ active: servico('1', 'Culto vazio', []) });

    render(<ServiceOrder />);

    expect(screen.getByText(/Nenhum item ainda/)).toBeInTheDocument();
  });
});
