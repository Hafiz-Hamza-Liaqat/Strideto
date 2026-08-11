/**
 * Strideto semantic design tokens — light and dark (Phase 1 foundation).
 *
 * Single canonical token system for all role portals. Portals consume CSS
 * variables via BrandProvider; per-role color forks are discouraged.
 */
export const semanticTokensLight = Object.freeze({
  pageBackground: '#F8FAFC',
  navigationBackground: '#FFFFFF',
  elevatedSurface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  inputBackground: '#FFFFFF',
  inputText: '#0F172A',
  placeholder: '#94A3B8',
  focus: '#2563EB',
  disabled: '#CBD5E1',
  primaryAction: '#2563EB',
  primaryActionHover: '#1D4ED8',
  secondaryAction: '#F1F5F9',
  secondaryActionText: '#334155',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#0EA5E9',
});

export const semanticTokensDark = Object.freeze({
  pageBackground: '#0F172A',
  navigationBackground: '#1E293B',
  elevatedSurface: '#1E293B',
  card: '#1E293B',
  border: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  inputBackground: '#0F172A',
  inputText: '#F1F5F9',
  placeholder: '#64748B',
  focus: '#60A5FA',
  disabled: '#475569',
  primaryAction: '#3B82F6',
  primaryActionHover: '#2563EB',
  secondaryAction: '#334155',
  secondaryActionText: '#E2E8F0',
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#38BDF8',
});

/** CSS custom property names (without -- prefix). */
export const SEMANTIC_TOKEN_KEYS = Object.freeze([
  'semantic-page-bg',
  'semantic-nav-bg',
  'semantic-elevated',
  'semantic-card',
  'semantic-border',
  'semantic-text-primary',
  'semantic-text-secondary',
  'semantic-text-muted',
  'semantic-input-bg',
  'semantic-input-text',
  'semantic-placeholder',
  'semantic-focus',
  'semantic-disabled',
  'semantic-primary',
  'semantic-primary-hover',
  'semantic-secondary',
  'semantic-secondary-text',
  'semantic-success',
  'semantic-warning',
  'semantic-danger',
  'semantic-info',
]);

function mapTokensToCssVars(tokens) {
  return {
    'semantic-page-bg': tokens.pageBackground,
    'semantic-nav-bg': tokens.navigationBackground,
    'semantic-elevated': tokens.elevatedSurface,
    'semantic-card': tokens.card,
    'semantic-border': tokens.border,
    'semantic-text-primary': tokens.textPrimary,
    'semantic-text-secondary': tokens.textSecondary,
    'semantic-text-muted': tokens.textMuted,
    'semantic-input-bg': tokens.inputBackground,
    'semantic-input-text': tokens.inputText,
    'semantic-placeholder': tokens.placeholder,
    'semantic-focus': tokens.focus,
    'semantic-disabled': tokens.disabled,
    'semantic-primary': tokens.primaryAction,
    'semantic-primary-hover': tokens.primaryActionHover,
    'semantic-secondary': tokens.secondaryAction,
    'semantic-secondary-text': tokens.secondaryActionText,
    'semantic-success': tokens.success,
    'semantic-warning': tokens.warning,
    'semantic-danger': tokens.danger,
    'semantic-info': tokens.info,
  };
}

export const semanticLightCssVars = Object.freeze(mapTokensToCssVars(semanticTokensLight));
export const semanticDarkCssVars = Object.freeze(mapTokensToCssVars(semanticTokensDark));

/** Minimum contrast-safe pairs for static contract verification (WCAG AA intent). */
export const CONTRAST_SAFE_PAIRS = Object.freeze([
  { fg: 'textPrimary', bg: 'pageBackground' },
  { fg: 'textPrimary', bg: 'card' },
  { fg: 'textSecondary', bg: 'pageBackground' },
  { fg: 'inputText', bg: 'inputBackground' },
  { fg: 'primaryAction', bg: 'pageBackground' },
]);

export function semanticCssVarsForTheme(mode = 'light') {
  return mode === 'dark' ? semanticDarkCssVars : semanticLightCssVars;
}
