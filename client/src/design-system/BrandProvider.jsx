import { useEffect } from 'react';
import { colorCssVars } from './colors.js';
import { BRAND_NAME, BRAND_TAGLINE } from './brand.js';

/**
 * Injects design-system CSS variables and brand meta on documentElement.
 * Complements ThemeProvider (light/dark class); does not replace it.
 */
export function BrandProvider({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(colorCssVars).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
    root.dataset.brand = BRAND_NAME;
    root.dataset.tagline = BRAND_TAGLINE;
  }, []);

  return children;
}

export default BrandProvider;
