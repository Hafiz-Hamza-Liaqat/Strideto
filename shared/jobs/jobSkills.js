/**
 * Canonical Job skills normalization.
 *
 * Job documents historically arrive as arrays or as editor text. Keep the
 * storage contract as Array<String>, while accepting the common separators
 * used by existing Admin records and pasted job descriptions.
 */

const MAX_SAFE_COMMA_LINE_LENGTH = 400;
const MAX_SAFE_COMMA_ITEM_LENGTH = 80;

function cleanItem(value) {
  return String(value ?? '')
    .replace(/^\s*[-*•‣▪◦]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeProse(value) {
  const text = cleanItem(value);
  if (text.length > MAX_SAFE_COMMA_LINE_LENGTH) return true;
  if (/[.!?](?:\s|$)/.test(text)) return true;
  if (/\b(?:applications?|experience|responsibilities|requirements?|preferred|reviewed|apply|must|will)\b/i.test(text)
    && text.split(/\s+/).length > 10) return true;
  return false;
}

function splitTextItem(value) {
  const raw = String(value ?? '').replace(/\r\n?/g, '\n');
  if (!raw.trim()) return [];

  const parts = raw.split(/[;\n]/).map(cleanItem).filter(Boolean);
  const expanded = [];
  for (const part of parts) {
    if (!part.includes(',') || looksLikeProse(part)) {
      expanded.push(part);
      continue;
    }
    const commaParts = part.split(',').map(cleanItem).filter(Boolean);
    if (
      commaParts.length > 1
      && part.length <= MAX_SAFE_COMMA_LINE_LENGTH
      && commaParts.every((item) => item.length <= MAX_SAFE_COMMA_ITEM_LENGTH)
    ) {
      expanded.push(...commaParts);
    } else {
      expanded.push(part);
    }
  }
  return expanded;
}

export function normalizeJobSkills(value) {
  const input = Array.isArray(value) ? value : [value];
  const result = [];
  const seen = new Set();
  for (const item of input) {
    for (const skill of splitTextItem(item)) {
      const key = skill.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(skill);
      }
    }
  }
  return result;
}
