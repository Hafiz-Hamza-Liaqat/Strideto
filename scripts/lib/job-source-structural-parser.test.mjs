import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobSource } from './job-source-structural-parser.mjs';

const check = (html, expected) => {
  const result = parseJobSource(html);
  for (const [key, value] of Object.entries(expected)) {
    if (Array.isArray(value)) assert.deepEqual(result[key], value, key);
    else if (typeof value === 'function') assert.equal(value(result), true, key);
    else assert.equal(result[key], value, key);
  }
  return result;
};

test('h2 + ul responsibilities', () => check('<h2>Responsibilities</h2><ul><li>Lead the program.</li><li>Build workflows.</li></ul>', { responsibilities: ['Lead the program.', 'Build workflows.'] }));
test('h3 + ol requirements', () => check('<h3>Requirements</h3><ol><li>Five years of experience.</li><li>Bachelor\'s degree.</li></ol>', { requirements: ['Five years of experience.', "Bachelor's degree."], experience: ['Five years of experience.'], education: ["Bachelor's degree."] }));
test('strong and b headings', () => { const r = parseJobSource('<strong>Skills</strong><ul><li>SQL</li></ul><b>Benefits</b><p>Health coverage.</p>'); assert.deepEqual(r.skills, ['SQL']); assert.deepEqual(r.benefits, ['Health coverage.']); });
test('standalone bold paragraph heading', () => check('<p><strong>What You Will Do</strong></p><p>Own delivery.</p>', { responsibilities: ['Own delivery.'] }));
test('nested lists are extracted without parent duplication', () => check('<h2>Responsibilities</h2><ul><li>Lead teams<ul><li>Coach managers</li></ul></li></ul>', { responsibilities: ['Lead teams', 'Coach managers'] }));
test('mixed paragraphs and lists preserve section content', () => check('<h2>Requirements</h2><p>Strong judgment.</p><ul><li>Clear writing.</li></ul>', { requirements: ['Strong judgment.', 'Clear writing.'] }));
test('benefits section', () => check('<h2>Employee Benefits</h2><ul><li>Paid leave</li></ul>', { benefits: ['Paid leave'] }));
test('skills section', () => check('<h2>Technical Skills</h2><ul><li>TypeScript</li></ul>', { skills: ['TypeScript'] }));
test('explicit experience promotion', () => check('<h2>Qualifications</h2><p>At least 7 years of experience in finance.</p>', { experience: ['At least 7 years of experience in finance.'] }));
test('explicit education promotion', () => check('<h2>Qualifications</h2><p>Bachelor degree in engineering required.</p>', { education: ['Bachelor degree in engineering required.'] }));
test('no false experience promotion', () => { const r = parseJobSource('<h2>Responsibilities</h2><p>Experience the team culture while leading launches.</p>'); assert.deepEqual(r.experience, []); });
test('no false education promotion', () => { const r = parseJobSource('<h2>Responsibilities</h2><p>Educate customers about the product.</p>'); assert.deepEqual(r.education, []); });
test('EEO/legal boilerplate excluded', () => { const r = parseJobSource('<h2>Requirements</h2><ul><li>Strong writing.</li></ul><h2>EEO</h2><p>We are an equal opportunity employer.</p>'); assert.deepEqual(r.requirements, ['Strong writing.']); assert.equal(r.unmappedHeadings.some((x) => x.normalizedHeading === 'eeo'), false); });
test('Unicode punctuation and entities', () => check('<h2>What You&rsquo;ll Do</h2><ul><li>Use&nbsp;data &amp; tools &mdash; daily.</li></ul>', { responsibilities: ['Use data & tools - daily.'] }));
test('duplicate items are removed', () => check('<h2>Skills</h2><ul><li>SQL</li><li> SQL </li><li>Python</li></ul>', { skills: ['SQL', 'Python'] }));
test('unmapped substantive heading diagnostics', () => { const r = parseJobSource('<h2>Team Context</h2><p>Work with product and design partners.</p>'); assert.deepEqual(r.unmappedHeadings, [{ normalizedHeading: 'team context', originalHeading: 'Team Context', itemContentCount: 1 }]); });
test('genuinely thin source is SOURCE_THIN_OK', () => check('<p>Coordinate hiring operations for the listed team and location.</p>', { extractionClassification: 'SOURCE_THIN_OK' }));
test('rich complete source is EXTRACTION_COMPLETE', () => check('<h2>Responsibilities</h2><ul><li>Lead delivery.</li><li>Coordinate teams.</li></ul><h2>Requirements</h2><ul><li>Five years of experience.</li><li>Bachelor degree.</li></ul>', { extractionClassification: 'EXTRACTION_COMPLETE' }));
test('rich partially unmapped source is EXTRACTION_INCOMPLETE', () => check('<h2>Responsibilities</h2><ul><li>Lead delivery.</li></ul><h2>Team Context</h2><p>Work with product and design partners on a large operating program.</p><h2>Requirements</h2><ul><li>Strong judgment.</li></ul>', { extractionClassification: 'EXTRACTION_INCOMPLETE' }));
test('Greenhouse-style encoded HTML', () => check('<div><p><strong>What You\'ll Do</strong></p><div><ul><li>Own the roadmap.</li></ul></div><p><strong>What We\'re Looking For</strong></p><div><ul><li>Strong communication.</li></ul></div></div>', { responsibilities: ['Own the roadmap.'], requirements: ['Strong communication.'] }));
test('Lever-style structured content', () => check('<div><h3>Responsibilities</h3><div><p>Manage accounts.</p><ul><li>Build relationships.</li></ul></div><h3>Qualifications</h3><ul><li>Experience in sales.</li></ul></div>', { responsibilities: ['Manage accounts.', 'Build relationships.'], requirements: ['Experience in sales.'] }));
test('heading whitespace and casing variation', () => check('<h2>  WHAT   YOU   WILL   DO: </h2><ul><li>Plan work.</li></ul>', { responsibilities: ['Plan work.'] }));
test('nested subsection boundaries', () => { const r = parseJobSource('<h2>Responsibilities</h2><ul><li>Lead work.</li></ul><h3>Day to day</h3><p>Coordinate delivery.</p><h2>Requirements</h2><ul><li>Clear writing.</li></ul>'); assert.deepEqual(r.responsibilities, ['Lead work.']); assert.deepEqual(r.requirements, ['Clear writing.']); assert.equal(r.unmappedHeadings[0].normalizedHeading, 'day to day'); });
test('observed employer aliases and nested div boundaries', () => check('<div><p><b>You will:</b></p><div><ul><li>Coordinate launch testing.</li></ul></div><p><b>You have:</b></p><div><ol><li>Two years of experience.</li></ol></div><p><b>Compensation &amp; benefits</b></p><div><p>Health coverage.</p></div></div>', { responsibilities: ['Coordinate launch testing.'], requirements: ['Two years of experience.'], benefits: ['Health coverage.'], extractionClassification: 'EXTRACTION_COMPLETE' }));
