/**
 * Strideto typography tokens
 */
export const fontFamilies = {
  heading: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
  body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  urdu: ['"Noto Nastaliq Urdu"', 'Inter', 'serif'],
  arabic: ['"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
};

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

/** Type scale: rem sizes + line-heights */
export const typeScale = {
  h1: { size: '2.25rem', lineHeight: '1.2', weight: 700 },
  h2: { size: '1.875rem', lineHeight: '1.3', weight: 700 },
  h3: { size: '1.5rem', lineHeight: '1.35', weight: 600 },
  h4: { size: '1.25rem', lineHeight: '1.4', weight: 600 },
  body: { size: '1rem', lineHeight: '1.6', weight: 400 },
  small: { size: '0.875rem', lineHeight: '1.5', weight: 400 },
  caption: { size: '0.75rem', lineHeight: '1.4', weight: 500 },
};

export default { fontFamilies, fontWeights, typeScale };
