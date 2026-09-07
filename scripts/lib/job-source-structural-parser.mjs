const ENTITY_MAP = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"],
  ['nbsp', ' '], ['ndash', '–'], ['mdash', '—'], ['lsquo', '‘'], ['rsquo', '’'],
  ['ldquo', '“'], ['rdquo', '”'], ['bull', '•'],
]);

const BOILERPLATE_HEADING = /^(?:eeo|equal opportunity|privacy|privacy notice|legal|legal disclaimer|accommodation|reasonable accommodation|diversity statement|cookie|cookies|terms|terms of use)$/i;
const BOILERPLATE_CONTENT = /(?:equal opportunity employer|eeo|reasonable accommodation|privacy policy|cookie policy|terms of use|personal data|applicant privacy|we do not discriminate)/i;

const ALIASES = Object.freeze({
  responsibilities: [
    /^responsibilit(?:y|ies)$/, /^what you ll do$/, /^what you will do$/, /^you will$/, /^duties$/,
    /^role responsibilities$/, /^key responsibilities$/, /^what success looks like$/, /^what to expect$/,
    /^fellows workstreams$/,
  ],
  requirements: [
    /^requirements?$/, /^qualifications?$/, /^what we re looking for$/, /^what we are looking for$/,
    /^what you bring$/, /^you have$/, /^minimum qualifications?$/, /^basic qualifications?$/,
    /^required qualifications?$/, /^preferred qualifications?$/, /^desired qualifications?$/,
    /^preferred skills and experience$/, /^additional requirements?$/, /^itar requirements?$/,
    /^what you ll bring$/, /^what youll bring$/, /^candidates must(?: be)?:?$/, /^unique candidate criteria$/,
    /^you may be a good fit if you:?$/, /^strong candidates may also have:?$/,
    /^across the workstreams you may be a good fit if you:?$/, /^we prefer:?$/,
    /^for this role you ll find success through:?$/, /^travel requirements?$/,
  ],
  skills: [/^skills?$/, /^technical skills?$/, /^competencies$/, /^capabilities$/, /^bonus points for$/, /^nice to have$/],
  benefits: [/^benefits?$/, /^perks$/, /^our perks$/, /^compensation and benefits$/, /^compensation benefits$/, /^what we offer$/, /^employee benefits$/, /^your package may include:?$/, /^compensation$/],
  experience: [/^experience$/, /^experience requirements?$/, /^professional experience$/],
  education: [/^education$/, /^educational qualifications?$/, /^degree requirements?$/, /^certifications?$/],
});

const BLOCK_TAGS = new Set(['address', 'article', 'aside', 'blockquote', 'body', 'div', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'li', 'main', 'nav', 'ol', 'p', 'section', 'ul']);

function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x?[\da-f]+|[a-z][\w]+);/gi, (full, code) => {
    const lower = String(code).toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ENTITY_MAP.get(lower) ?? full;
  });
}

function normalizePunctuation(value) {
  return decodeEntities(value)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u2022\u25e6\u2043]/g, '•')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeading(value) {
  return normalizePunctuation(value)
    .toLowerCase()
    .replace(/[：:|]+$/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function node(tag, attrs = {}) {
  return { tag, attrs, children: [], parent: null };
}

function parseHtml(input) {
  const root = node('#root');
  const stack = [root];
  const source = decodeEntities(input);
  const tokens = source.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g) || [source];
  for (const token of tokens) {
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (!token.startsWith('<')) {
      stack[stack.length - 1].children.push({ tag: '#text', text: token, parent: stack[stack.length - 1] });
      continue;
    }
    if (/^<\//.test(token)) {
      const closing = token.slice(2, -1).trim().toLowerCase();
      const index = stack.findLastIndex((entry) => entry.tag === closing);
      if (index > 0) stack.length = index;
      continue;
    }
    const match = token.match(/^<\s*([a-z][\w:-]*)([^>]*)>/i);
    if (!match) continue;
    const tag = match[1].toLowerCase();
    const attrs = Object.fromEntries([...match[2].matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map((m) => [m[1].toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')]));
    const child = node(tag, attrs);
    child.parent = stack[stack.length - 1];
    stack[stack.length - 1].children.push(child);
    if (!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag) && !/\/\s*>$/.test(token)) stack.push(child);
  }
  return root;
}

function directText(current) {
  return normalizePunctuation(current.children.filter((child) => child.tag === '#text').map((child) => child.text).join(' '));
}

function textOf(current) {
  if (!current) return '';
  if (current.tag === '#text') return current.text;
  return current.children.map(textOf).join(' ');
}

function hasBlockChild(current) {
  return current.children.some((child) => BLOCK_TAGS.has(child.tag));
}

function isBoldOnly(current) {
  if (!['p', 'div'].includes(current.tag)) return false;
  const meaningful = current.children.filter((child) => normalizePunctuation(textOf(child)));
  return meaningful.length > 0 && meaningful.every((child) => child.tag === 'strong' || child.tag === 'b' || child.tag === '#text' && !normalizePunctuation(child.text));
}

function isHeadingLike(current, siblings, index) {
  if (!current || current.tag === '#text') return false;
  if (/^h[1-6]$/.test(current.tag)) return true;
  if (current.tag === 'strong' || current.tag === 'b') return true;
  if (isBoldOnly(current)) return true;
  if (['p', 'div'].includes(current.tag) && !hasBlockChild(current)) {
    const value = normalizePunctuation(textOf(current));
    const next = siblings[index + 1];
    const normalized = normalizeHeading(value);
    return value.length > 0 && value.length <= 90 && next
      && (next.tag === 'ul' || next.tag === 'ol' || next.tag === 'p' || next.tag === 'div')
      && (semanticType(normalized) || /:$/.test(value));
  }
  return false;
}

function directListItems(current) {
  const items = [];
  const visit = (candidate, nested = false) => {
    if (!candidate || candidate.tag === '#text') return;
    if (candidate.tag === 'li') {
      const own = candidate.children.filter((child) => !['ul', 'ol'].includes(child.tag)).map(textOf).join(' ');
      const value = normalizePunctuation(own);
      if (value) items.push({ value, nested });
      for (const child of candidate.children.filter((child) => ['ul', 'ol'].includes(child.tag))) visit(child, true);
      return;
    }
    for (const child of candidate.children) visit(child, nested);
  };
  visit(current);
  return items;
}

function flow(current) {
  if (!current || current.tag === '#text') return [];
  const events = [];
  const walk = (candidate, siblings = [], index = 0) => {
    if (!candidate || candidate.tag === '#text') return;
    if (isHeadingLike(candidate, siblings, index)) {
      const original = normalizePunctuation(textOf(candidate));
      if (original) events.push({ kind: 'heading', original, normalized: normalizeHeading(original) });
      return;
    }
    if (candidate.tag === 'ul' || candidate.tag === 'ol') {
      const items = directListItems(candidate).map((item) => item.value).filter(Boolean);
      if (items.length) events.push({ kind: 'list', items });
      return;
    }
    if (['p', 'div', 'section', 'article', 'main', 'body', '#root'].includes(candidate.tag) && hasBlockChild(candidate)) {
      candidate.children.forEach((child, childIndex) => walk(child, candidate.children, childIndex));
      return;
    }
    const value = normalizePunctuation(textOf(candidate));
    if (value && !hasBlockChild(candidate) && !BOILERPLATE_CONTENT.test(value)) events.push({ kind: 'paragraph', items: [value] });
  };
  walk(current, current.parent?.children || [], current.parent?.children?.indexOf(current) || 0);
  return events;
}

function semanticType(normalized) {
  for (const [type, patterns] of Object.entries(ALIASES)) if (patterns.some((pattern) => pattern.test(normalized))) return type;
  return null;
}

function dedupe(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizePunctuation(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function explicitExperience(values) {
  return dedupe(values.filter((value) => /\b(?:\d+\+?\s+years?|years?\s+of\s+experience|prior experience|professional experience|industry experience|experience with|experience in)\b/i.test(value)));
}

function explicitEducation(values) {
  return dedupe(values.filter((value) => /\b(?:bachelor(?:'s)?|master(?:'s)?|ph\.?d|doctorate|degree|diploma|certification|certified|undergraduate|graduate degree|educational qualification)\b/i.test(value)));
}

function isSubstantive(value, kind = 'paragraph') {
  const normalized = normalizePunctuation(value);
  const minimum = kind === 'list' ? 2 : 5;
  return normalized.length >= minimum && !BOILERPLATE_CONTENT.test(value);
}

function isContextualHeading(value) {
  return /^(?:about .+|why [^ ]+|the opportunity|interview process|logistics(?: .*)?|how we re different|come work with us!?|work environment|work eligibility|how to apply|additional information|where we work|how we work|rest and play|rest play|health and family|health family|work & career|work career|our commitment to diversity.*|ai safety fellows|ai security fellows|ml systems & performance fellows|the anthropic institute fellows.*|anthropic fellows program overview|hesitant to apply\??|annual salary:?|this is a full time role based in .+|construction .+|sr manager .+|mentors research areas past projects|candidates must be|you may be a good fit if you)$/i.test(value);
}

export function parseJobSource(rawHtml, options = {}) {
  const root = parseHtml(rawHtml);
  const source = normalizePunctuation(textOf(root));
  const events = flow(root);
  const sections = [];
  const unsectioned = [];
  let current = null;
  for (const event of events) {
    if (event.kind === 'heading') {
      current = { heading: event.original, normalizedHeading: event.normalized, semanticType: semanticType(event.normalized) || 'other', items: [], paragraphs: [], content: [] };
      sections.push(current);
    } else if (current) {
      const target = event.items.filter((value) => isSubstantive(value, event.kind));
      if (event.kind === 'list') current.items.push(...target);
      else current.paragraphs.push(...target);
      current.content.push(...target);
    } else {
      unsectioned.push(...event.items.filter((value) => isSubstantive(value, event.kind)));
    }
  }
  const mapped = Object.fromEntries(['responsibilities', 'requirements', 'skills', 'benefits', 'experience', 'education'].map((key) => [key, []]));
  const unmappedHeadings = [];
  for (const section of sections) {
    const content = dedupe(section.content);
    if (!content.length || BOILERPLATE_HEADING.test(section.normalizedHeading)) continue;
    if (section.semanticType === 'other') {
      unmappedHeadings.push({ normalizedHeading: section.normalizedHeading, originalHeading: section.heading, itemContentCount: content.length });
    } else mapped[section.semanticType].push(...content);
  }
  for (const key of Object.keys(mapped)) mapped[key] = dedupe(mapped[key]);
  mapped.experience = explicitExperience([...mapped.experience, ...mapped.requirements]);
  mapped.education = explicitEducation([...mapped.education, ...mapped.requirements]);
  const meaningful = [...mapped.responsibilities, ...mapped.requirements, ...mapped.skills, ...mapped.benefits, ...unsectioned].length;
  const rich = source.length >= (options.richTextLength ?? 700) || sections.length >= 2 || meaningful >= 4;
  const hasMappedCore = mapped.responsibilities.length > 0 && mapped.requirements.length > 0;
  const substantiveUnmapped = unmappedHeadings.some((heading) => heading.itemContentCount > 0 && !isContextualHeading(heading.normalizedHeading));
  let extractionClassification;
  if (!source || source.length < 30) extractionClassification = 'EXTRACTION_INCOMPLETE';
  else if (!rich && (meaningful > 0 || source.length >= (options.thinTextLength ?? 120))) extractionClassification = 'SOURCE_THIN_OK';
  else if (rich && substantiveUnmapped) extractionClassification = 'EXTRACTION_INCOMPLETE';
  else if (rich && (hasMappedCore || meaningful >= 2)) extractionClassification = 'EXTRACTION_COMPLETE';
  else extractionClassification = 'EXTRACTION_INCOMPLETE';
  return { ...mapped, sections, unmappedHeadings, extractionClassification };
}

export { decodeEntities, normalizeHeading, normalizePunctuation, semanticType };
