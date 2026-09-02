/** Normalize optional Job list-like editorial fields into the canonical array shape. */
export function normalizeJobTextList(value) {
  const input = Array.isArray(value) ? value : [value];
  const result = [];
  const seen = new Set();
  for (const raw of input) {
    const parts = String(raw ?? '')
      .replace(/\r\n?/g, '\n')
      .split(/[;,\n]/)
      .map((item) => item.replace(/^\s*[-*•‣▪◦]\s*/, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    for (const item of parts) {
      const key = item.toLocaleLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }
  return result;
}
