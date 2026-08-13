# STRIDETO PHASE 17C-V — Visual consistency, international inputs & role UX

This is an implementation + focused regression record. It is **not** Phase 18 certification.

## Root causes (pre-fix)

| Defect | Actual cause |
| --- | --- |
| Limited phone country list | `shared/international/phone.js` shipped ~20 calling codes. `PhoneInput` filtered the full ISO list through `getCountryCallingCode`, so only those 20 appeared. |
| Black date/time icons | Global `html.dark … filter: invert(1)` on `::-webkit-calendar-picker-indicator` is unreliable in Chromium/Edge. Light mode was also at risk from invert. |
| Narrow Jobs country dropdown | `CountrySelect` list was `w-full` of a narrow filter trigger and used a page-local absolute list (no portal / min-width). |
| Agent empty-step complete | `advance()` always `submitOnboardingStep` then `setCurrentStep(+1)` with no required-field gate. Server accepted any valid step key. |
| Missing Institution first-use guide | Dashboard had next-actions cards, not a first-use timeline for states A–E. Help did not repeat the journey. |
| Weak role current-nav | Route `aria-current` existed, but selected styling was hover-similar (`bg-primary/10`) with no persistent accent. |
| Inconsistent portal logos | Employer used text `appName`; Agent/Institution used symbol + “Strideto” linking to the dashboard, not `/`. |
| Light-theme white navbar | Public header used `bg-surface` so Light appearance turned the shell white and swapped wordmark tone. |

## Shared international inputs

- Canonical countries: `shared/international/country.js` `ISO_3166_ALPHA2` (~249).
- Canonical calling codes: `shared/international/callingCodes.js` (ITU E.164, ISO identity; US/CA share `1`; NANP territories use longer prefixes).
- Phone catalog: `listPhoneCountries()` derived from ISO ∩ calling codes.
- `PhoneInput` / `CountrySelect` share `SearchableSelect` (combobox, portal, flip/shift, viewport clamp).
- No silent US/PK phone default. Phone country may follow an explicitly selected profile country until the user overrides it.
- Country → Region → City: `LocationCascadeFilter` / Employer post-job use `regionsForCountry` only; unknown countries get free-text, never another country’s provinces.

### Remaining exceptions

- `SCHOLARSHIP_COUNTRIES` (`Pakistan`, `UK`, `USA`, `Australia`, `Other`) remains a **legacy destination-name facet** for scholarship records stored as free-text names. Replacing it with ISO without a data migration would hide listings. It is not used as a general country/phone catalog.

## Theme controls

- Tokens: `--surface`, `--icon`, `--accent-orange`, etc. on `:root` / `html.dark`.
- Unwrapped `input[type=date|time|datetime-local]` inherit mask + `background-color: var(--icon)` (no global invert).
- Representative pages use `DateInput` / `TimeInput` (one `currentColor` trigger; native indicator hidden).
- `FormField.jsx` and `AdminTableFilters.jsx` were **not** edited (known WIP). They inherit the shared native indicator CSS.

## Role UX

- `PortalBrand` → `/` for Employer, Agent, Institution. Subtitle remains role-specific. Public home navigation does not log the user out.
- Shared `portalNavLinkClass`: default / hover / focus-visible / current (`aria-current="page"` + orange start border).
- Public navbar: always `#0F172A` with `logo-light` full wordmark.
- Agent onboarding: shared `validateAgentOnboardingStep`; server rejects empty required steps; skip only where policy allows; progress updates after successful save.
- Institution getting-started guide: dashboard (dismissible via existing portal-onboarding flag) + `/institution/help`. States A–E are unit-tested from workspace fields, not production fixtures.
