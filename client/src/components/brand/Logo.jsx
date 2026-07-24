import { BRAND_NAME, BRAND_ASSETS } from '../../design-system/brand.js';

/**
 * Responsive Strideto logo.
 * @param {'full'|'symbol'|'wordmark'} variant
 * @param {'auto'|'light'|'dark'} tone — auto picks light mark on dark surfaces
 */
export function Logo({
  variant = 'full',
  tone = 'auto',
  className = '',
  height = 32,
  title = BRAND_NAME,
}) {
  let src = BRAND_ASSETS.logo;
  if (variant === 'symbol') src = BRAND_ASSETS.symbol;
  else if (variant === 'wordmark') src = BRAND_ASSETS.wordmark;
  else if (tone === 'light') src = BRAND_ASSETS.logoLight;
  else if (tone === 'dark') src = BRAND_ASSETS.logoDark;

  const h = typeof height === 'number' ? `${height}px` : height;

  return (
    <img
      src={src}
      alt={title}
      height={typeof height === 'number' ? height : undefined}
      className={`inline-block object-contain ${className}`}
      style={{ height: h, width: 'auto' }}
      decoding="async"
    />
  );
}

export default Logo;
