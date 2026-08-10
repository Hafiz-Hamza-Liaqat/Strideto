import { Component } from 'react';

/**
 * Route-level error boundary (Mission 26).
 *
 * `useRoutes` is not a data router, so React Router's `errorElement` never runs
 * here. Without a boundary, one unexpected field in one record throws during
 * render and React unmounts the whole tree — the user gets a blank page on
 * every subsequent route until a full reload.
 *
 * Every page is wrapped through `lazyLoad`, so this boundary keeps the app
 * shell alive and renders a truthful error state instead. It never claims the
 * action succeeded and never prints a stack trace to the user.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Developer-facing only; never rendered into the page.
    if (import.meta.env.DEV) console.error('Route render failed', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          This page could not be displayed
        </h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Something went wrong while rendering this page. Nothing was changed or
          submitted. Reload the page, or use the navigation to continue.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded bg-blue-700 px-4 py-2 text-sm text-white"
        >
          Reload this page
        </button>
      </main>
    );
  }
}
