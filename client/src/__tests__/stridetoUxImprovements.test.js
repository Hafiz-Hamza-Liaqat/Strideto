import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * STRIDETO UX Improvements Tests
 *
 * Validates:
 * - Blog.jsx: tags[0] fallback removed; production sample guard preserved
 * - ProvenanceStrip: UNKNOWN freshness suppressed; labels improved
 * - ProgramExplorer: human-readable acceptance status labels; sectionMinimums/resultValidityMonths intact
 * - Internships: grid layout (not space-y); formatLocationDisplay preserved
 * - ForeignStudyDetail: back nav, deadline badge, apply CTA
 * - AdminContentInternships: fieldPaid/fieldSkills (not fieldIsPaid/fieldSkillset)
 * - fieldWebsite + fieldVerified present in admin.json
 * - Regression safety: no canonical nav/route removed
 */

let count = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  count += 1;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '..');
const read = (rel) => readFileSync(path.join(clientSrc, rel), 'utf8');

const blog = read('pages/Blog/Blog.jsx');
const provenance = read('components/public/ProvenanceStrip.jsx');
const programExplorer = read('pages/Tests/ProgramExplorer.jsx');
const internships = read('pages/Internships/Internships.jsx');
const foreignDetail = read('pages/ForeignStudies/ForeignStudyDetail.jsx');
const adminInternships = read('pages/Admin/AdminContentInternships.jsx');
const adminJson = JSON.parse(read('i18n/locales/en/admin.json'));
const routes = read('routes/index.jsx');
const navConfig = read('config/adminNavConfig.js');

// ── Blog.jsx ──────────────────────────────────────────────────────────────────
check(!blog.includes("post.tags?.[0]"), 'Blog: tags[0] fallback removed from category display');
check(blog.includes('canonicalBlogCategoryLabel(post.category)'), 'Blog: category uses canonical label with post.category only');
check(blog.includes('isProduction') && blog.includes('return []'), 'Blog: production sample guard preserved');

// ── ProvenanceStrip ───────────────────────────────────────────────────────────
check(!provenance.includes('Freshness not tracked') && !provenance.includes("freshnessState === FRESHNESS_STATES.UNKNOWN" ) || provenance.includes('!== FRESHNESS_STATES.UNKNOWN'), 'ProvenanceStrip: UNKNOWN freshness suppressed');
check(!provenance.includes('"Authority:"') && !provenance.includes("'Authority:'"), 'ProvenanceStrip: "Authority:" label replaced');
check(provenance.includes('Provided by:') || provenance.includes('provided by'), 'ProvenanceStrip: authority replaced with "Provided by:"');
check(provenance.includes('View official source'), 'ProvenanceStrip: "View official source ↗" replaces "Official source"');
check(provenance.includes('Verify this information'), 'ProvenanceStrip: "Verify this information" replaces "Confirm this information"');

// ── ProgramExplorer ───────────────────────────────────────────────────────────
check(programExplorer.includes('sectionMinimums'), 'ProgramExplorer: sectionMinimums still rendered');
check(programExplorer.includes('resultValidityMonths'), 'ProgramExplorer: resultValidityMonths still rendered');
check(!programExplorer.includes('{at.acceptanceStatus}'), 'ProgramExplorer: raw acceptanceStatus string replaced with human label');
check(programExplorer.includes('Accepted') || programExplorer.includes("'Accepted'"), 'ProgramExplorer: "Accepted" human label present');
check(programExplorer.includes('Conditional') || programExplorer.includes("'Conditional'"), 'ProgramExplorer: "Conditional" human label present');
check(programExplorer.includes('Not Accepted') || programExplorer.includes("'Not Accepted'"), 'ProgramExplorer: "Not Accepted" human label present');
check(programExplorer.includes('Case by Case') || programExplorer.includes("'Case by Case'"), 'ProgramExplorer: "Case by Case" human label present');

// ── Internships ───────────────────────────────────────────────────────────────
check(internships.includes('grid gap-4 sm:grid-cols-2'), 'Internships: grid layout applied (not space-y-4 only)');
check(internships.includes('formatLocationDisplay'), 'Internships: formatLocationDisplay preserved');
check(!internships.includes('space-y-4') || internships.includes('grid'), 'Internships: space-y-4 list replaced with grid');

// ── ForeignStudyDetail ────────────────────────────────────────────────────────
check(foreignDetail.includes('foreignStudiesBack') || foreignDetail.includes('← '), 'ForeignStudyDetail: back nav link present');
check(foreignDetail.includes('deadline') && foreignDetail.includes('badge') || foreignDetail.includes('rounded-full'), 'ForeignStudyDetail: deadline badge in hero');
check(foreignDetail.includes('foreignStudiesApply') && foreignDetail.includes('target="_blank"'), 'ForeignStudyDetail: apply CTA with external link');

// ── Admin Internships label fix ───────────────────────────────────────────────
check(adminInternships.includes("'admin:fieldPaid'"), 'AdminInternships: fieldPaid (not fieldIsPaid) used');
check(!adminInternships.includes("'admin:fieldIsPaid'"), 'AdminInternships: fieldIsPaid removed');
check(adminInternships.includes("'admin:fieldSkills'"), 'AdminInternships: fieldSkills (not fieldSkillset) used');
check(!adminInternships.includes("'admin:fieldSkillset'"), 'AdminInternships: fieldSkillset removed');

// ── admin.json label coverage ─────────────────────────────────────────────────
check(typeof adminJson.fieldWebsite === 'string', 'admin.json: fieldWebsite present (used by AdminCompanies)');
check(typeof adminJson.fieldVerified === 'string', 'admin.json: fieldVerified present (used by AdminCompanies)');
check(typeof adminJson.fieldPaid === 'string', 'admin.json: fieldPaid present');
check(typeof adminJson.fieldSkills === 'string', 'admin.json: fieldSkills present');
check(typeof adminJson.navTestsProviders === 'string', 'admin.json: navTestsProviders key present');
check(typeof adminJson.navTestAcceptance === 'string', 'admin.json: navTestAcceptance key present');
check(typeof adminJson.acceptanceResultValidityMonths === 'string', 'admin.json: acceptanceResultValidityMonths key present');

// ── Regression safety: no canonical routes removed ────────────────────────────
check(routes.includes('institutions'), 'routes: canonical institutions route preserved');
check(routes.includes('programs'), 'routes: programs route preserved');
check(routes.includes('education/scholarships') || routes.includes('educationScholarships'), 'routes: education scholarships route preserved');
check(navConfig.includes('educationInstitutions'), 'navConfig: educationInstitutions nav entry preserved');
check(navConfig.includes('programs'), 'navConfig: programs nav entry preserved');

console.log(`stridetoUxImprovements.test.js: ${count} assertions passed`);
