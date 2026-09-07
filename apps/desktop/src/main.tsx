import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app';
import { ErrorBoundary } from '@/components/error-boundary';
import { ProjectionScreen } from '@/components/presentation/projection-screen';
import { currentWindowRole } from '@/lib/window-role';
import '@/styles/globals.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Elemento #root nao encontrado em index.html');
}

// O papel e' decidido de forma sincrona, antes do primeiro render: a janela de
// projecao nunca pode mostrar o Control Room, nem por um quadro.
const role = currentWindowRole();

if (role === 'projection') {
  document.body.classList.add('projection');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>{role === 'projection' ? <ProjectionScreen /> : <App />}</ErrorBoundary>
  </StrictMode>,
);
