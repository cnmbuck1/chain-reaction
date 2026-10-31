import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { SafeArea, type SafeAreaInsets } from 'capacitor-plugin-safe-area';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './ui/app.css';

const native = Capacitor.isNativePlatform();

// Inside another app's frame (such as a preview), that app already keeps clear of the
// phone's notch, so the game drops its own safe-area padding. The phone apps never are:
// their web view can look framed, and the padding is what keeps the header off the clock.
const embedded = (() => {
  if (native) return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
document.documentElement.classList.toggle('embedded', embedded);
document.documentElement.classList.toggle('native', native);

// The phone apps' web view can report the notch and status bar as zero to CSS, so the app
// asks the phone and sets --safe-top and friends itself. The CSS falls back to env() elsewhere.
// The top is never less than the status bar's own height.
if (native) {
  let statusBar = 0;
  const setVar = (side: string, px: number) =>
    document.documentElement.style.setProperty(`--safe-${side}`, `${px}px`);
  const apply = ({ insets }: SafeAreaInsets) => {
    for (const [side, px] of Object.entries(insets)) {
      setVar(side, side === 'top' ? Math.max(px, statusBar) : px);
    }
  };
  void SafeArea.getStatusBarHeight()
    .then(({ statusBarHeight }) => {
      statusBar = statusBarHeight;
      setVar('top', statusBar);
    })
    .catch(() => {})
    .then(() => SafeArea.getSafeAreaInsets())
    .then(apply, () => {});
  void SafeArea.addListener('safeAreaChanged', apply).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
