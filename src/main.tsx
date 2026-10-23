import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './ui/app.css';

// Inside another app's frame (such as a preview), that app already keeps clear of the
// phone's notch, so the game drops its own safe-area padding.
const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
document.documentElement.classList.toggle('embedded', embedded);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
