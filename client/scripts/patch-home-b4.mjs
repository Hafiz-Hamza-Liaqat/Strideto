import fs from 'fs';

const p = 'src/pages/Home/Home.jsx';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

const start = s.indexOf('placementId="home-top"');
if (start < 0) {
  console.error('home-top not found');
  process.exit(1);
}
// rewind to start of ScrollReveal for home-top
const blockStart = s.lastIndexOf('<ScrollReveal', start);
const end = s.lastIndexOf(`${nl}    </>${nl}`);
if (blockStart < 0 || end < 0) {
  console.error('markers', blockStart, end);
  process.exit(1);
}

const insert = [
  '      <ScrollReveal as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-4">',
  '        <AdHost placementId="home-top" />',
  '      </ScrollReveal>',
  '',
  '      <HomePersonalizedBody',
  '        persona={persona}',
  '        homepage={homepage}',
  '        t={t}',
  '        isAuthenticated={isAuthenticated}',
  '        recommended={recommended}',
  '        loadingRecommended={loadingRecommended}',
  '        loadingTrending={loadingTrending}',
  '        loadingBlogs={loadingBlogs}',
  '        trendingJobs={trendingJobs}',
  '        latestScholarships={latestScholarships}',
  '        admissionDeadlines={admissionDeadlines}',
  '        blogs={blogs}',
  '        savedIds={savedIds}',
  '        handleSaveJob={handleSaveJob}',
  '        handleSaveScholarship={handleSaveScholarship}',
  '        handleSaveAdmission={handleSaveAdmission}',
  '        showJobs={showJobs}',
  '        showScholarships={showScholarships}',
  '        showAdmissions={showAdmissions}',
  '        foreignStudyCountries={foreignStudyCountries}',
  '        testimonials={testimonials}',
  '        partners={partners}',
  '        studentResources={studentResources}',
  '        newsletterBlock={newsletterBlock}',
  '      />',
  '',
  '      <ScrollReveal><AdHost placementId="home-mid-1" variant="inline" /></ScrollReveal>',
  '',
  '      <ScrollReveal as="section" className="max-w-6xl mx-auto px-4 sm:px-6 py-6">',
  '        <AdHost placementId="home-footer" />',
  '      </ScrollReveal>',
  '',
].join(nl);

s = s.slice(0, blockStart) + insert + s.slice(end);

if (!s.includes("from '../../components/home/HomePersonalizedBody'")) {
  s = s.replace(
    "import { Button } from '../../components/common/Button';",
    "import { Button } from '../../components/common/Button';" + nl + "import { HomePersonalizedBody } from '../../components/home/HomePersonalizedBody';"
  );
}

s = s.replace(/\r?\n\s*const homeSectionOrder = orderedHomeSections\(persona\);/, '');
s = s.replace(/\r?\n\s*orderedHomeSections,\r?\n/, nl);

fs.writeFileSync(p, s);
console.log('Home.jsx updated ok');
