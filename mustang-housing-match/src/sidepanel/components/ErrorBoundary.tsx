import { Component, type ComponentChildren } from "preact";

interface State { error: Error | null }

/** Last resort so a render exception shows the message instead of a blank side panel. */
export class PanelErrorBoundary extends Component<{ children: ComponentChildren }, State> {
  override state: State = { error: null };

  static override getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || "The panel hit an unexpected error.";
    return (
      <div class="app">
        <main class="app__main">
          <div class="notice notice--danger" role="alert">
            <span class="notice__icon" aria-hidden="true">!</span>
            <div>
              <div class="notice__title">The panel couldn't render</div>
              <div class="notice__body">{message} Reload the panel and try again.</div>
            </div>
          </div>
          <div class="actions">
            <button class="btn btn--primary" type="button" onClick={() => location.reload()}>Reload panel</button>
          </div>
        </main>
      </div>
    );
  }
}
