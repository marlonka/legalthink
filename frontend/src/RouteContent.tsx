import { Component, Suspense, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { ErrorMessage } from './ui';

export class RouteContent extends Component<
  { children: ReactNode; onReturn: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <section className="standard-page">
          <ErrorMessage>
            Ansicht konnte nicht geladen werden. Sichern Sie offene Eingaben und laden Sie die Seite
            neu.
          </ErrorMessage>
          <button className="button secondary" onClick={this.props.onReturn}>
            Neue Analyse
          </button>
        </section>
      );
    return (
      <Suspense
        fallback={
          <div className="loading-state" role="status">
            <LoaderCircle className="spin" size={22} />
            Ansicht wird geladen …
          </div>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
