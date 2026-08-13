import { Component } from 'react';

export class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[AdminErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            {this.state.error?.message || 'An unexpected error occurred on this page.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function normalizeGenerateResult(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    summary: data.summary != null ? String(data.summary) : '',
    description: data.description != null ? String(data.description) : '',
    sections: data.sections && typeof data.sections === 'object' ? data.sections : null,
    suggested: data.suggested && typeof data.suggested === 'object' ? data.suggested : null,
    aiConfigured: data.aiConfigured === true,
  };
}

export { normalizeGenerateResult };
