import { Component, type ReactNode } from 'react';

/** Last line of defense: a crash shows a way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="select crash" role="alert">
        <h1>Something jammed</h1>
        <p className="tagline">
          The game hit an unexpected error. Your progress is saved on this device.
        </p>
        <button type="button" className="run" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
