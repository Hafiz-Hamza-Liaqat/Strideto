/**
 * Strideto design tokens — colors
 * Single source of truth for Tailwind, CSS variables, and theme.
 */
export const colors = {
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryLight: '#DBEAFE',
  accent: '#F97316',
  accentHover: '#EA580C',
  background: '#F8FAFC',
  backgroundCard: '#FFFFFF',
  backgroundSection: '#F1F5F9',
  dark: '#0F172A',
  darkElevated: '#1E293B',
  textSecondary: '#64748B',
  textHeading: '#0F172A',
  textBody: '#334155',
  border: '#E2E8F0',
  success: '#16A34A',
  successHover: '#15803D',
  warning: '#F59E0B',
  danger: '#DC2626',
  dangerHover: '#B91C1C',
  white: '#FFFFFF',
  footerBg: '#0F172A',
  footerText: '#94A3B8',
  footerHeading: '#CBD5F5',
};

/** CSS custom property map (without -- prefix) */
export const colorCssVars = {
  'color-primary': colors.primary,
  'color-primary-hover': colors.primaryHover,
  'color-primary-light': colors.primaryLight,
  'color-accent': colors.accent,
  'color-accent-hover': colors.accentHover,
  'color-bg': colors.background,
  'color-bg-card': colors.backgroundCard,
  'color-bg-section': colors.backgroundSection,
  'color-dark': colors.dark,
  'color-dark-elevated': colors.darkElevated,
  'color-text-secondary': colors.textSecondary,
  'color-text-heading': colors.textHeading,
  'color-text-body': colors.textBody,
  'color-border': colors.border,
  'color-success': colors.success,
  'color-warning': colors.warning,
  'color-danger': colors.danger,
  'color-footer-bg': colors.footerBg,
  'color-footer-text': colors.footerText,
  'color-footer-heading': colors.footerHeading,
};

export default colors;
