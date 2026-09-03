import { PRODUCTION_PUBLIC_ORIGIN } from '../../../../shared/seo/publicSiteOrigin.js';

export const PUBLIC_SPA_SHELL_URL = `${PRODUCTION_PUBLIC_ORIGIN}/index.html`;

export function isValidPublicSpaShell(html) {
  if (typeof html !== 'string' || !html.trim()) return false;
  if (!/<html(?:\s|>)/i.test(html) || !/<body(?:\s|>)/i.test(html)) return false;
  if (!/\bid\s*=\s*["']root["']/i.test(html) || !/\/assets\//i.test(html)) return false;
  if (/\/_next\//i.test(html) || /sso-api/i.test(html) || /log in to vercel/i.test(html)) return false;
  return true;
}

export async function fetchPublicSpaShell(timeoutMs = 5000) {
  const response = await fetch(PUBLIC_SPA_SHELL_URL, {
    headers: { accept: 'text/html' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Public SPA shell returned HTTP ${response.status}`);
  const html = await response.text();
  if (!isValidPublicSpaShell(html)) throw new Error('Public SPA shell failed integrity validation');
  return html;
}
