import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardShortcutsPanel } from './keyboard-shortcuts-panel';
import {
  resetKeyboardShortcutsStore,
  useKeyboardShortcutsStore,
} from '@/store/keyboard-shortcuts-store';

beforeEach(() => {
  resetKeyboardShortcutsStore();
});

describe('KeyboardShortcutsPanel', () => {
  it('comeca fechado, sem mostrar a lista de atalhos', () => {
    render(<KeyboardShortcutsPanel />);

    expect(screen.queryByText('Proximo slide')).not.toBeInTheDocument();
  });

  it('abre e mostra as seis acoes com a tecla atual', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsPanel />);

    await user.click(screen.getByRole('button', { name: 'Atalhos' }));

    expect(screen.getByText('Proximo slide')).toBeInTheDocument();
    expect(screen.getByText('Tela preta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
  });

  it('clicar numa tecla comeca a captura', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsPanel />);
    await user.click(screen.getByRole('button', { name: 'Atalhos' }));

    await user.click(screen.getByRole('button', { name: 'B' }));

    expect(screen.getByText(/pressione uma tecla/i)).toBeInTheDocument();
    expect(useKeyboardShortcutsStore.getState().capturing).toBe('toggleBlackout');
  });

  it('mostra o erro quando uma tecla ja esta em uso', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsPanel />);
    await user.click(screen.getByRole('button', { name: 'Atalhos' }));

    // Simula o que o hook global faria ao capturar "ArrowLeft" (ja usado por
    // "previous") para a acao "next".
    act(() => useKeyboardShortcutsStore.getState().bind('next', 'ArrowLeft'));

    expect(await screen.findByRole('alert')).toHaveTextContent('já está em uso');
  });

  it('restaurar padrao volta a tecla trocada', async () => {
    const user = userEvent.setup();
    useKeyboardShortcutsStore.getState().bind('next', 'n');
    render(<KeyboardShortcutsPanel />);
    await user.click(screen.getByRole('button', { name: 'Atalhos' }));

    await user.click(screen.getByRole('button', { name: 'Restaurar padrao' }));

    expect(screen.getByRole('button', { name: '→' })).toBeInTheDocument();
  });
});
