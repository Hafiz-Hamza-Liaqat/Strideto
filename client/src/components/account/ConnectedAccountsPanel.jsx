import { connectedAccountCatalog } from '@shared/auth/connectedAccounts.js';

export function ConnectedAccountsPanel() {
  const rows = connectedAccountCatalog({
    OAUTH_GOOGLE_ENABLED: import.meta.env.VITE_OAUTH_GOOGLE_ENABLED,
    OAUTH_APPLE_ENABLED: import.meta.env.VITE_OAUTH_APPLE_ENABLED,
    OAUTH_MICROSOFT_ENABLED: import.meta.env.VITE_OAUTH_MICROSOFT_ENABLED,
  });

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connected accounts</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        External providers cannot grant verification, canonical authority, or Trust status.
        Sign-in buttons appear only after a provider is configured.
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={row.provider}
            className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
          >
            <span className="capitalize text-gray-800 dark:text-gray-200">{row.provider}</span>
            <span className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {row.state.replace('_', ' ')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
