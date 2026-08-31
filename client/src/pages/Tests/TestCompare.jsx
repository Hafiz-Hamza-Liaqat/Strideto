import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SeoHead } from '../../components/seo';
import { testsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';

const CATEGORY_LABELS = {
  english_proficiency: 'English proficiency',
  admissions: 'Graduate admissions',
  national_qualification: 'National qualification',
  professional: 'Professional',
  other: 'Other',
};

const FIELD_LABELS = [
  ['providerId', 'Provider', (test) => test.providerId?.name || 'Not specified'],
  ['purposes', 'Common purposes', (test) => (test.purposes || []).join(', ') || 'Not specified'],
  ['deliveryModes', 'Delivery modes', (test) => (test.deliveryModes || []).map((mode) => mode.replace(/_/g, ' ')).join(', ') || 'Not specified'],
  ['sections', 'Sections/components', (test) => (test.sections || []).map((section) => section.name || section).join(', ') || 'Not specified'],
  ['scoreScale', 'Score scale', (test) => test.scoreScale || 'Not specified'],
  ['totalDurationMinutes', 'Approximate duration', (test) => test.totalDurationMinutes ? `${test.totalDurationMinutes} minutes` : 'Not specified'],
  ['validityMonths', 'Result validity', (test) => test.validityMonths ? `${test.validityMonths} months` : 'Not specified by the current catalog'],
  ['prepGuideAvailable', 'Preparation guidance', (test) => test.prepGuideAvailable ? 'Available' : 'Not currently available'],
  ['resourceCount', 'External resources', (test) => test.resourceCount ? `${test.resourceCount} verified resource${test.resourceCount === 1 ? '' : 's'}` : 'No verified resource currently available'],
  ['verifiedAcceptanceCount', 'STRIDETO acceptance coverage', (test) => `${test.verifiedAcceptanceCount || 0} verified requirement${test.verifiedAcceptanceCount === 1 ? '' : 's'} currently available on Strideto`],
];

function TestColumn({ test }) {
  return (
    <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">{CATEGORY_LABELS[test.category] || test.category}</p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white break-words">{test.name}</h2>
      {test.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{test.description}</p>}
      <Link className="mt-3 inline-block text-sm text-blue-600 dark:text-blue-400 underline" to={`${ROUTES.TEST_HUB}/${test.slug}`}>
        Read the {test.shortName || test.name} guide
      </Link>
    </article>
  );
}

export default function TestCompare() {
  const [tests, setTests] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
    testsApi.compare()
      .then(({ data }) => {
        setTests(data?.data || []);
        setState((data?.data || []).length ? 'data' : 'empty');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <>
      <SeoHead
        title="Compare International Tests | Strideto"
        description="Compare international English-proficiency and graduate-admissions tests by format, scoring, delivery and preparation resources."
        canonical={ROUTES.TEST_COMPARE}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Link to={ROUTES.TEST_HUB} className="hover:underline">International Tests</Link>
          <span className="mx-2" aria-hidden="true">›</span>
          <span className="text-gray-700 dark:text-gray-200">Compare</span>
        </nav>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Compare international tests</h1>
        <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-400">
          Use factual differences to shortlist a test, then confirm the exact requirement for your institution or program. No test is universally best; acceptance and pathway rules vary.
        </p>

        {state === 'loading' && <p className="mt-8 text-gray-600 dark:text-gray-300" aria-live="polite">Loading comparison…</p>}
        {state === 'error' && <p className="mt-8 text-red-600 dark:text-red-400" role="alert">Comparison could not be loaded. Please try again later.</p>}
        {state === 'empty' && <p className="mt-8 text-gray-600 dark:text-gray-300">Insufficient verified data to compare tests.</p>}
        {state === 'data' && (
          <>
            {Object.entries(
              tests.reduce((groups, test) => {
                const key = test.category || 'other';
                groups[key] = [...(groups[key] || []), test];
                return groups;
              }, {})
            ).map(([category, group]) => (
              <section key={category} className="mt-8" aria-labelledby={`comparison-${category}`}>
                <h2 id={`comparison-${category}`} className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((test) => <TestColumn key={test._id || test.slug} test={test} />)}
                </div>
                {category === 'english_proficiency' && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">These tests measure English proficiency. Check program-specific acceptance before choosing among them.</p>
                )}
                {category === 'admissions' && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">These are graduate-admissions tests. They do not replace an English-proficiency requirement unless the institution explicitly says so.</p>
                )}
              </section>
            ))}

            <section className="mt-8 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700" aria-labelledby="comparison-details">
              <h2 id="comparison-details" className="sr-only">Test comparison details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-[42rem] w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">Dimension</th>
                      {tests.map((test) => <th scope="col" key={test._id || test.slug} className="px-4 py-3 align-top font-medium text-gray-700 dark:text-gray-200 break-words">{test.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {FIELD_LABELS.map(([key, label, value]) => (
                      <tr key={key}>
                        <th scope="row" className="px-4 py-3 align-top font-medium text-gray-700 dark:text-gray-200">{label}</th>
                        {tests.map((test) => <td key={test._id || test.slug} className="px-4 py-3 align-top text-gray-600 dark:text-gray-300 break-words">{value(test)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Acceptance coverage counts are Strideto’s verified requirement records, not a worldwide acceptance census.</p>
          </>
        )}
      </main>
    </>
  );
}
