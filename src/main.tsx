import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { SafeArea, type SafeAreaInsets } from 'capacitor-plugin-safe-area';
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

// The phone apps' web view can report the notch and status bar as zero to CSS, so the app
// asks the phone and sets --safe-top and friends itself. The CSS falls back to env() elsewhere.
if (Capacitor.isNativePlatform()) {
  const apply = ({ insets }: SafeAreaInsets) => {
    for (const [side, px] of Object.entries(insets)) {
      document.documentElement.style.setProperty(`--safe-${side}`, `${px}px`);
    }
  };
  void SafeArea.getSafeAreaInsets().then(apply, () => {});
  void SafeArea.addListener('safeAreaChanged', apply).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
