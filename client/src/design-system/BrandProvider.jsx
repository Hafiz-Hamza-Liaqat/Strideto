import { useEffect } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';
import { colorCssVars } from './colors.js';
import { semanticCssVarsForTheme } from './semanticTokens.js';
import { BRAND_NAME, BRAND_TAGLINE } from './brand.js';

/**
 * Injects design-system CSS variables and brand meta on documentElement.
 * Applies semantic light/dark tokens alongside legacy color aliases.
 */
export function BrandProvider({ children }) {
  const { theme, resolvedTheme } = useTheme();
  const appliedTheme = resolvedTheme === 'dark' || theme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(colorCssVars).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    const semanticVars = semanticCssVarsForTheme(appliedTheme);
    Object.entries(semanticVars).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    root.dataset.brand = BRAND_NAME;
    root.dataset.tagline = BRAND_TAGLINE;
  }, [appliedTheme]);

  return children;
}

export default BrandProvider;
