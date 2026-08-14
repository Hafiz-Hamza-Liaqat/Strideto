import { PROVIDER_DOMAIN_IDS } from '@shared/provider/providerDomains.js';

/**
 * Multi-select provider-domain cards. Selected state is not color-only.
 */
export function ProviderDomainCards({
  domains = [],
  selectedIds = [],
  onToggle,
  required = true,
  error = '',
  disabled = false,
  name = 'provider-domains',
}) {
  const selected = new Set(selectedIds);

  return (
    <fieldset
      className="min-w-0"
      aria-required={required ? 'true' : undefined}
      aria-describedby={`${name}-hint${error ? ` ${name}-error` : ''}`}
      aria-invalid={error ? 'true' : undefined}
    >
      <legend className="text-sm font-medium text-gray-900 dark:text-white">
        What services do you want to provide?
        {required ? <span className="text-red-700 dark:text-red-400"> *</span> : <span className="text-gray-500"> (Optional)</span>}
      </legend>
      <p id={`${name}-hint`} className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Select one or both. This configures your Provider Workspace. It does not verify professional credentials.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {domains.map((domain) => {
          const checked = selected.has(domain.domainId);
          const comingSoon = domain.comingSoon || domain.selectable === false;
          const inputId = `${name}-${domain.domainId}`;
          return (
            <label
              key={domain.domainId}
              htmlFor={inputId}
              className={`relative flex min-w-0 cursor-pointer flex-col rounded-xl border-2 p-4 min-h-[44px] ${
                comingSoon
                  ? 'cursor-not-allowed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-70'
                  : checked
                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <span className="flex items-start gap-3 min-w-0">
                <input
                  id={inputId}
                  type="checkbox"
                  name={name}
                  value={domain.domainId}
                  checked={checked}
                  disabled={disabled || comingSoon}
                  onChange={() => !comingSoon && onToggle?.(domain.domainId)}
                  className="mt-1 h-4 w-4 shrink-0"
                  aria-describedby={`${inputId}-desc`}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white break-words">
                      {domain.publicName}
                    </span>
                    {checked ? (
                      <span className="rounded-full border border-primary px-2 py-0.5 text-xs font-medium text-primary">
                        Selected
                      </span>
                    ) : null}
                    {comingSoon ? (
                      <span className="rounded-full border border-gray-400 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                        Coming soon
                      </span>
                    ) : null}
                  </span>
                  <span id={`${inputId}-desc`} className="mt-1 block text-sm text-gray-600 dark:text-gray-400 break-words">
                    {domain.onboardingDescription || domain.description}
                  </span>
                  {domain.domainId === PROVIDER_DOMAIN_IDS.BUSINESS_SERVICES ? (
                    <span className="mt-2 block text-xs text-gray-500 dark:text-gray-400 break-words">
                      Does not grant Business Formation, Registered Agent, or ACSP verification.
                    </span>
                  ) : (
                    <span className="mt-2 block text-xs text-gray-500 dark:text-gray-400 break-words">
                      Does not automatically approve Education & Mobility professional verification.
                    </span>
                  )}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-2 text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
