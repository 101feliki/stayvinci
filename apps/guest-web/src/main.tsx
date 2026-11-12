import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './app/App';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: false } },
});

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// A crash shows a calm message instead of a blank page (details only in development).
createRoot(root, {
  onUncaughtError: (error) => {
    const detail =
      import.meta.env.DEV && error instanceof Error ? (error.stack ?? error.message) : '';
    root.innerHTML = `<div style="max-width:28rem;margin:20vh auto;padding:0 1.5rem;font-family:Inter,sans-serif;text-align:center"><h1 style="font-size:1.25rem;font-weight:600">Something went wrong</h1><p style="color:#6b6b70;font-size:.9rem">Please reload the page.</p><pre id="sv-crash" style="text-align:left;white-space:pre-wrap;font-size:11px;color:#a33"></pre></div>`;
    const pre = document.getElementById('sv-crash');
    if (pre) pre.textContent = detail;
  },
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: 'rounded-xl border border-line bg-surface font-sans text-sm shadow-pop',
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
);
