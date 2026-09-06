/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Porta fixa: o Tauri precisa saber onde o dev server responde.
const DEV_PORT = 1420;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // O Tauri controla o processo; falhar alto e' melhor do que trocar de porta
  // silenciosamente e o app abrir uma tela branca.
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    watch: {
      // O diretorio do Rust tem seu proprio watcher (cargo/tauri).
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    // Alvo alinhado ao WebView do Tauri v2 (WebKitGTK / WebView2 / WKWebView).
    target: 'es2022',
    sourcemap: true,
    // Requisito de leveza: o bundle e' um orcamento, nao um detalhe.
    chunkSizeWarningLimit: 500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
