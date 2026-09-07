import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DisplayState, MonitorInfo } from '@holy-media/types';
import { DisplayPicker } from './display-picker';
import { resetDisplayStore, useDisplayStore } from '@/store/display-store';
import * as api from '@/lib/display-api';

vi.mock('@/lib/display-api');

function monitor(index: number, name: string, isCurrent = false): MonitorInfo {
  // Resolucoes diferentes de proposito: e' o caso real (notebook + projetor) e
  // deixa cada linha identificavel no teste.
  return {
    index,
    name,
    width: isCurrent ? 1366 : 1920,
    height: isCurrent ? 768 : 1080,
    isCurrent,
  };
}

function estado(overrides: Partial<DisplayState> = {}): DisplayState {
  return {
    monitors: [monitor(0, 'Tela do notebook', true), monitor(1, 'Projetor')],
    isOpen: false,
    monitorIndex: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  resetDisplayStore();
});

describe('DisplayPicker', () => {
  it('lista os monitores conectados com a resolucao', async () => {
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado());

    render(<DisplayPicker />);

    expect(await screen.findByText('Projetor')).toBeInTheDocument();
    expect(screen.getByText(/1920 × 1080/)).toBeInTheDocument();
    expect(screen.getByText(/1366 × 768/)).toBeInTheDocument();
  });

  it('avisa qual monitor e o do proprio operador', async () => {
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado());

    render(<DisplayPicker />);

    // Projetar aqui cobriria a tela de quem esta operando.
    expect(await screen.findByText(/tela do operador/)).toBeInTheDocument();
  });

  it('abre a projecao no monitor escolhido', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado());
    vi.mocked(api.openDisplay).mockResolvedValue(estado({ isOpen: true, monitorIndex: 1 }));

    render(<DisplayPicker />);
    await user.click(await screen.findByRole('button', { name: /Projetor/ }));

    await waitFor(() => expect(api.openDisplay).toHaveBeenCalledWith(1));
  });

  it('marca o monitor em uso e oferece fechar', async () => {
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado({ isOpen: true, monitorIndex: 1 }));

    render(<DisplayPicker />);

    expect(await screen.findByText('no ar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fechar/ })).toBeInTheDocument();
  });

  it('nao oferece fechar quando a projecao esta desligada', async () => {
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado());

    render(<DisplayPicker />);
    await screen.findByText('Projetor');

    expect(screen.queryByRole('button', { name: /Fechar/ })).not.toBeInTheDocument();
  });

  it('mostra a mensagem do nucleo quando o monitor sumiu', async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado());
    vi.mocked(api.openDisplay).mockRejectedValue({
      code: 'DISPLAY_FAILED',
      message: 'O monitor escolhido nao esta mais conectado.',
    });

    render(<DisplayPicker />);
    await user.click(await screen.findByRole('button', { name: /Projetor/ }));

    // O cabo do projetor cair no meio do culto e' caso real, nao hipotese.
    expect(await screen.findByRole('alert')).toHaveTextContent('nao esta mais conectado');
  });

  it('avisa quando nao ha monitor nenhum', async () => {
    vi.mocked(api.fetchDisplayState).mockResolvedValue(estado({ monitors: [] }));

    render(<DisplayPicker />);

    expect(await screen.findByText('Nenhum monitor detectado.')).toBeInTheDocument();
  });

  it('nao alarma o operador quando roda fora do aplicativo', async () => {
    vi.mocked(api.fetchDisplayState).mockRejectedValue({
      code: 'IPC_UNAVAILABLE',
      message: 'Este recurso so esta disponivel no aplicativo instalado.',
    });

    render(<DisplayPicker />);

    await waitFor(() => expect(api.fetchDisplayState).toHaveBeenCalled());
    expect(useDisplayStore.getState().error).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
