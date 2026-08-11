const DEFAULT_COPYRIGHT = '© 2026 Strideto';

export function sanitizePublicCopyright(text) {
  if (!text || typeof text !== 'string') return DEFAULT_COPYRIGHT;
  const cleaned = text
    .replace(/\s*[·•]\s*Open source under MIT License\.?/gi, '')
    .replace(/\s*MIT لائسنس[^·•]*\.?/gi, '')
    .replace(/https?:\/\/github\.com\/\S+/gi, '')
    .replace(/\bsource code available\b[^.]*/gi, '')
    .trim();
  return cleaned || DEFAULT_COPYRIGHT;
}

export function isForbiddenPublicHref(path) {
  const p = String(path || '').toLowerCase().trim();
  if (!p) return true;
  if (p.includes('github.com')) return true;
  if (p.includes('localhost')) return true;
  if (p.includes('127.0.0.1')) return true;
  if (p.includes('roadmap') || p.includes('/docs/')) return true;
  if (p === '/license' || p.endsWith('/license')) return true;
  if (p.includes('/admin')) return true;
  return false;
}
