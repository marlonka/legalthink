import { Component, Suspense, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { ErrorMessage } from './ui';

/** Renders `fallback` instead of children that failed; `retry` renders them again. */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}

export function RouteContent({
  children,
  onReturn,
}: {
  children: ReactNode;
  onReturn: () => void;
}) {
  return (
    <ErrorBoundary
      fallback={(retry) => (
        <section className="standard-page">
          <ErrorMessage>
            Ansicht konnte nicht geladen werden. Sichern Sie offene Eingaben und laden Sie die Seite
            neu.
          </ErrorMessage>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              // Also when the failed page is "Neue Analyse" itself.
              retry();
              onReturn();
            }}
          >
            Neue Analyse
          </button>
        </section>
      )}
    >
      <Suspense
        fallback={
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" size={22} />
            Ansicht wird geladen …
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
