/**
 * CONTENT-AUTOFILL-P2.2 — semantic link import + rendering tests.
 * Run: node src/__tests__/contentAutofillP22.test.js
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const links = await import(pathToFileURL(path.join(root, 'shared/blog/blogLinks.js')).href);
const canonical = await import(pathToFileURL(path.join(root, 'shared/cms/blogCanonicalHtml.js')).href);
const { inlineMarkdown, normalizeBlogContent } = await import(
  pathToFileURL(path.join(root, 'shared/blog/blogContent.js')).href
);
const { sanitizeHtml } = await import(pathToFileURL(path.join(root, 'server/src/utils/htmlSanitize.js')).href);

const {
  buildSemanticLinkHtml,
  parseCitationParenthetical,
  normalizeBlogLinksInHtml,
  isStridetoSiteHref,
  BLOG_EXTERNAL_LINK_CLASS,
} = links;
const { structuredContentToCanonicalBlogHtml, SOURCES_WRAPPER_CLASS, mammothHtmlToCanonicalBlogHtml } = canonical;

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

function linkSemantics(href) {
  const html = buildSemanticLinkHtml('Label', href);
  return {
    html,
    external: html.includes(BLOG_EXTERNAL_LINK_CLASS),
    blank: html.includes('target="_blank"'),
    internal: isStridetoSiteHref(href) && !html.includes(BLOG_EXTERNAL_LINK_CLASS),
  };
}

function hrefAttrCount(html) {
  return (html.match(/\bhref\s*=/gi) || []).length;
}

// --- Host classification ---
check(linkSemantics('/jobs').external === false && !linkSemantics('/jobs').blank, 'P22-HOST-01 relative internal');
check(linkSemantics('/jobs').internal, 'P22-HOST-01b relative isStridetoSiteHref');

const apex = linkSemantics('https://strideto.com/jobs');
check(apex.external === false && !apex.blank, 'P22-HOST-02 apex internal');

const www = linkSemantics('https://www.strideto.com/jobs');
check(www.external === false && !www.blank, 'P22-HOST-03 www internal');

const subdomain = linkSemantics('https://api.strideto.com/jobs/x');
check(subdomain.external === false && !subdomain.blank, 'P22-HOST-04 strideto subdomain internal');

const lookalike = linkSemantics('https://notstrideto.com/jobs');
check(lookalike.external && lookalike.blank, 'P22-HOST-05 lookalike external');

const prefixAttack = linkSemantics('https://strideto.com.evil.example/jobs');
check(prefixAttack.external && prefixAttack.blank, 'P22-HOST-06 host-prefix attack external');

const thirdParty = linkSemantics('https://example.com');
check(thirdParty.external && thirdParty.blank, 'P22-HOST-07 third-party external');

const mailto = linkSemantics('mailto:careers@strideto.com');
check(!mailto.external && !mailto.blank && mailto.html.includes('href="mailto:'), 'P22-HOST-08 mailto preserved');

const TITLE = 'Immigration Service Delivery, Ireland — Long-term study visa';
const URL = 'https://www.irishimmigration.ie/coming-to-study-in-ireland/';

const mammothLike = `<p>See <a href="${URL}">${TITLE}</a> for details.</p>`;
const normalizedAnchor = mammothHtmlToCanonicalBlogHtml(mammothLike);
check(normalizedAnchor.includes(`href="${URL}"`), 'P22-A href preserved');
check(normalizedAnchor.includes(TITLE), 'P22-A visible title preserved');
check(normalizedAnchor.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-A external link class');
check(!normalizedAnchor.includes('(https://'), 'P22-A no parenthetical raw URL');
check(hrefAttrCount(normalizedAnchor) === 1, 'P22-A single href attribute');

const mammothStrideto = mammothHtmlToCanonicalBlogHtml('<a href="https://www.strideto.com/jobs">Jobs</a>');
check(hrefAttrCount(mammothStrideto) === 1, 'P22-NORM-01 mammoth strideto single href');
check(!mammothStrideto.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-NORM-02 mammoth strideto internal');
check(!mammothStrideto.includes('target="_blank"'), 'P22-NORM-03 mammoth strideto no blank target');

const reNormalized = normalizeBlogLinksInHtml(mammothStrideto);
check(reNormalized === mammothStrideto, 'P22-NORM-04 mammoth strideto idempotent');
check(hrefAttrCount(reNormalized) === 1, 'P22-NORM-05 re-normalize single href');

const mammothExternal = mammothHtmlToCanonicalBlogHtml(`<a href="${URL}">${TITLE}</a>`);
check(hrefAttrCount(mammothExternal) === 1, 'P22-NORM-06 mammoth external single href');
const mammothExternalTwice = normalizeBlogLinksInHtml(mammothExternal);
check(hrefAttrCount(mammothExternalTwice) === 1, 'P22-NORM-07 external re-normalize single href');
check(mammothExternalTwice.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-NORM-08 external class retained');

const citationLine = `${TITLE} (${URL})`;
const citationParsed = parseCitationParenthetical(citationLine);
check(citationParsed?.title === TITLE, 'P22-B parse citation title');
check(citationParsed?.href === URL, 'P22-B parse citation href');

const sourcesBlock = structuredContentToCanonicalBlogHtml(`Sources\n${TITLE}\n${URL}`);
check(sourcesBlock.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-B sources linked title');
check(sourcesBlock.includes(`>${TITLE}<`), 'P22-B sources visible title');
check(!sourcesBlock.includes('(https://'), 'P22-B sources no visible paren URL');

const parenSources = structuredContentToCanonicalBlogHtml(`Sources\n${TITLE} (${URL})`);
check(parenSources.includes(`href="${URL}"`), 'P22-B2 paren sources href');
check(!parenSources.includes(`(${URL})`), 'P22-B2 paren sources no duplicate URL text');

const urlOnly = structuredContentToCanonicalBlogHtml(
  'Sources\nhttps://www.irishimmigration.ie/biometrics/',
);
check(urlOnly.includes('href="https://www.irishimmigration.ie/biometrics/"'), 'P22-C url-only href');
check(urlOnly.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-C url-only external class');

const mdLink = inlineMarkdown('[Official site](https://example.com/path)');
check(mdLink.includes('href="https://example.com/path"'), 'P22-D markdown href');
check(mdLink.includes('>Official site<'), 'P22-D markdown label');
check(!mdLink.includes('(https://'), 'P22-D no paren duplication');

const unsafe = buildSemanticLinkHtml('click', 'javascript:alert(1)');
check(!unsafe.includes('<a '), 'P22-E unsafe not linked');
check(!unsafe.includes('javascript:'), 'P22-E unsafe stripped');

const unsafeSan = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
check(!unsafeSan.includes('javascript:'), 'P22-E sanitizer blocks javascript');

const publicHtml = normalizeBlogContent(`<p>${buildSemanticLinkHtml(TITLE, URL)}</p>`).html;
check(publicHtml.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-F public external class');
check(publicHtml.includes(`href="${URL}"`), 'P22-F public href');
check(publicHtml.includes(TITLE), 'P22-F public anchor text');

const internal = buildSemanticLinkHtml('Jobs board', '/jobs');
check(internal.includes('href="/jobs"'), 'P22-G internal href');
check(!internal.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-G internal no external class');
check(!internal.includes('target="_blank"'), 'P22-G internal no blank target');

const legacy = normalizeBlogLinksInHtml(
  `<div class="${SOURCES_WRAPPER_CLASS}"><h2>Sources</h2><ol><li><p>${TITLE} (<a href="${URL}">official link</a>)</p></li></ol></div>`,
);
check(legacy.includes(`href="${URL}"`), 'P22-H legacy sources href');
check(legacy.includes(TITLE), 'P22-H legacy sources title');
check(!legacy.includes('official link'), 'P22-H legacy no official link label');
check(!legacy.includes(`(${URL})`), 'P22-H legacy no paren url');

const para = structuredContentToCanonicalBlogHtml(`Visit ${URL} today.`);
check(para.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-I paragraph autolink class');
const list = structuredContentToCanonicalBlogHtml('Bullet List\nSee https://example.com/guide');
check(list.includes('href="https://example.com/guide"'), 'P22-I list autolink href');

const callout = structuredContentToCanonicalBlogHtml(
  `Important\nRead ${TITLE} (${URL}) before applying.`,
);
check(callout.includes(BLOG_EXTERNAL_LINK_CLASS), 'P22-I callout citation link');

const dirty = sanitizeHtml('<p onclick="x()"><script>a</script><a href="https://ok.test/x">Safe</a></p>');
check(!dirty.includes('onclick'), 'P22-sec onclick');
check(!dirty.includes('<script'), 'P22-sec script');
check(dirty.includes('href="https://ok.test/x"'), 'P22-sec safe link survives');

console.log(`CONTENT-AUTOFILL-P2.2: ${count} checks passed`);
