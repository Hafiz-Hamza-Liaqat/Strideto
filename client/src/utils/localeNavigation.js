import { buildLocalizedPath, stripLocaleFromPath } from '@shared/localization/localeUtils.js';
import { normalizeLocale } from '@shared/localization/localeResolver.js';
import { ENABLED_CONTENT_LOCALES, DEFAULT_LOCALE } from '@shared/localization/localeConfig.js';
import { isPrivateSeoPath } from '@shared/seo/robotsPolicy.js';

/**
 * Switch current path to another locale, preserving route structure.
 * @param {string} pathname
 * @param {string} targetLocale
 */
export function switchPathLocale(pathname, targetLocale) {
  const { path } = stripLocaleFromPath(pathname);
  return buildLocalizedPath(path, normalizeLocale(targetLocale));
}

/**
 * Build localized path for language switcher.
 */
export function localizedPathFor(currentPath, targetLocale) {
  const loc = normalizeLocale(targetLocale);
  const { path } = stripLocaleFromPath(currentPath);
  // Locale URL prefixes exist only for public discovery routes. Private
  // Student/org shells keep their unprefixed paths; i18n still applies via setLang.
  if (isPrivateSeoPath(path)) return path;
  if (loc === DEFAULT_LOCALE) return path;
  if (!ENABLED_CONTENT_LOCALES.includes(loc)) return path;
  return switchPathLocale(path, loc);
}
