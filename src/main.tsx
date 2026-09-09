import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register service worker for PWA offline caching if supported
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  try {
    registerSW({ immediate: true });
  } catch (e) {
    // Non-blocking in sandboxed environments or dev mode
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
