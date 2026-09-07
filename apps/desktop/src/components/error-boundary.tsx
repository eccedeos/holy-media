import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

const log = createLogger('ui');

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Rede de seguranca da interface (secao 22): um erro de render nunca pode
 * derrubar o aplicativo no meio de um culto. O operador ve uma tela sobria com
 * a opcao de voltar; o stack trace vai para o log.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('erro nao tratado na interface', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <h1 className="text-xl font-semibold">Algo deu errado nesta tela.</h1>
        <p className="max-w-md text-sm text-content-muted">
          A apresentacao em andamento nao foi interrompida. Voce pode tentar recarregar esta parte
          da interface.
        </p>
        <Button onClick={this.handleReset}>Tentar novamente</Button>
      </div>
    );
  }
}
