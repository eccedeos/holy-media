import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './app';
import { ErrorBoundary } from './components/error-boundary';
import { useAppStore } from './store/app-store';

describe('App', () => {
  it('renderiza a casca e mostra mensagem amigavel quando o nucleo nao responde', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Holy Media' })).toBeInTheDocument();

    // Sem runtime Tauri no jsdom, o handshake falha -- e a UI deve tratar isso.
    expect(
      await screen.findByText(/so esta disponivel no aplicativo instalado/i),
    ).toBeInTheDocument();
    expect(useAppStore.getState().status).toBe('error');
  });
});

describe('ErrorBoundary', () => {
  it('captura o erro do filho e mostra a tela de recuperacao', () => {
    function Exploding(): never {
      throw new Error('falha proposital');
    }

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado nesta tela.');
    expect(screen.queryByText(/falha proposital/)).not.toBeInTheDocument();
  });
});
