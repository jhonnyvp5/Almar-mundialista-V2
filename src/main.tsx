import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ReloadPrompt from './ReloadPrompt.tsx';
import './index.css';

// Global fetch interceptor to support custom API base URL defined in VITE_API_URL
try {
  const originalFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function (input: RequestInfo | URL, init?: RequestInit) {
      let finalInput = input;
      let baseUrl = ((import.meta as any).env?.VITE_API_URL as string) || '';
      
      // If running in development, localhost, or any AI Studio / Cloud Run test env (*.run.app),
      // we bypass VITE_API_URL to make relative requests so that local frontend talks directly to local backend.
      if (typeof window !== 'undefined' && (
        window.location.hostname.endsWith('.run.app') ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      )) {
        baseUrl = '';
      }

      if (baseUrl) {
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        if (typeof input === 'string') {
          if (input.startsWith('/api/')) {
            finalInput = cleanBaseUrl + input;
          }
        } else if (input instanceof URL) {
          if (input.pathname.startsWith('/api/')) {
            finalInput = new URL(cleanBaseUrl + input.pathname + input.search);
          }
        } else if (input instanceof Request) {
          if (input.url.startsWith('/api/')) {
            finalInput = new Request(cleanBaseUrl + input.url, input);
          }
        }
      }
      return originalFetch(finalInput, init);
    }
  });
} catch (e) {
  console.warn("Could not monkey-patch window.fetch. Using standard relative requests:", e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ReloadPrompt />
  </StrictMode>,
);
