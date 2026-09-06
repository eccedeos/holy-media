import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app';
import { ErrorBoundary } from '@/components/error-boundary';
import '@/styles/globals.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Elemento #root nao encontrado em index.html');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
